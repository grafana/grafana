package authnserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	grpclog "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	authnlib "github.com/grafana/authlib/authn"
	authnv1 "github.com/grafana/authlib/authn/proto/v1"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanaauthn "github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
)

type mockClient struct {
	name       string
	testResult bool
	authResult *AuthenticationResult
	authError  error

	gotTestCtx  context.Context
	gotAuthCtx  context.Context
	completions []CompletionStatus
	onComplete  func(CompletionStatus)
}

func (m *mockClient) Name() string { return m.name }

func (m *mockClient) Test(ctx context.Context, _ *authnv1.AuthenticateRequest) bool {
	m.gotTestCtx = ctx
	return m.testResult
}

func (m *mockClient) Authenticate(ctx context.Context, _ *authnv1.AuthenticateRequest) (*AuthenticationResult, error) {
	m.gotAuthCtx = ctx
	return m.authResult, m.authError
}

func (m *mockClient) AuthenticationCompleted(status CompletionStatus) {
	m.completions = append(m.completions, status)
	if m.onComplete != nil {
		m.onComplete(status)
	}
}

type fakeExchanger struct {
	token   string
	err     error
	calls   int
	lastReq authnlib.TokenExchangeRequest
	onCall  func()
}

func (f *fakeExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	f.calls++
	f.lastReq = req
	if f.onCall != nil {
		f.onCall()
	}
	if f.err != nil {
		return nil, f.err
	}
	return &authnlib.TokenExchangeResponse{Token: f.token}, nil
}

func newTestService(exchanger authnlib.TokenExchanger) *Service {
	return NewService(tracing.InitializeTracerForTest(), exchanger, []string{"aud-one", "aud-two"})
}

func successfulResult() *AuthenticationResult {
	return &AuthenticationResult{
		Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
		Identity: &grafanaauthn.Identity{
			ID:              "1",
			UID:             "user-uid",
			Type:            claims.TypeUser,
			OrgID:           1,
			OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
			Login:           "user-login",
			Name:            "User Name",
			Email:           "user@example.com",
			EmailVerified:   true,
			AuthenticatedBy: "session",
			Groups:          []string{"team-a"},
		},
		Request: &grafanaauthn.Request{OrgID: 1},
	}
}

func assertUnauthorizedBody(t *testing.T, body []byte) {
	t.Helper()
	var payload map[string]any
	require.NoError(t, json.Unmarshal(body, &payload))
	assert.Equal(t, "Unauthorized", payload["message"])
	assert.Contains(t, payload, "traceID")
}

func TestAuthenticateDispatch(t *testing.T) {
	req := &authnv1.AuthenticateRequest{
		Namespace:   "stacks-1234",
		HttpHeaders: map[string]string{"X-Access-Token": "some-token"},
	}

	t.Run("no clients registered returns NOT_HANDLED", func(t *testing.T) {
		resp, err := newTestService(&fakeExchanger{}).Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED, resp.Code)
	})

	t.Run("clients skipped by Test or NOT_HANDLED fall through", func(t *testing.T) {
		exchanger := &fakeExchanger{token: "exchanged"}
		svc := newTestService(exchanger)
		svc.RegisterClient(&mockClient{name: "skipped", testResult: false})
		svc.RegisterClient(&mockClient{
			name:       "declined",
			testResult: true,
			authResult: &AuthenticationResult{Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED},
		})
		svc.RegisterClient(&mockClient{name: "handled", testResult: true, authResult: successfulResult()})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, resp.Code)
		assert.Equal(t, "Bearer exchanged", resp.RequestHeaders["X-Access-Token"])
		assert.Equal(t, 1, exchanger.calls)
	})

	t.Run("FAILED does not fall through", func(t *testing.T) {
		exchanger := &fakeExchanger{}
		svc := newTestService(exchanger)
		failedClient := &mockClient{
			name:       "failed",
			testResult: true,
			authResult: &AuthenticationResult{
				Code:         authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED,
				ResponseBody: []byte("unauthorized"),
			},
		}
		svc.RegisterClient(failedClient)
		svc.RegisterClient(&mockClient{name: "backup", testResult: true, authResult: successfulResult()})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		assert.Equal(t, []byte("unauthorized"), resp.ResponseBody)
		assert.Zero(t, exchanger.calls)
		assert.Empty(t, failedClient.completions)
	})

	t.Run("client error propagates without fallthrough", func(t *testing.T) {
		svc := newTestService(&fakeExchanger{})
		svc.RegisterClient(&mockClient{name: "error", testResult: true, authError: errors.New("internal failure")})
		svc.RegisterClient(&mockClient{name: "backup", testResult: true, authResult: successfulResult()})

		resp, err := svc.Authenticate(context.Background(), req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "internal failure")
	})

	t.Run("nil client result returns an error", func(t *testing.T) {
		svc := newTestService(&fakeExchanger{})
		svc.RegisterClient(&mockClient{name: "nil-result", testResult: true})

		resp, err := svc.Authenticate(context.Background(), req)
		require.ErrorIs(t, err, errExpectedAuthenticationResult)
		assert.Nil(t, resp)
	})

	t.Run("namespace is propagated to client contexts", func(t *testing.T) {
		client := &mockClient{name: "capture", testResult: true, authResult: successfulResult()}
		svc := newTestService(&fakeExchanger{token: "exchanged"})
		svc.RegisterClient(client)

		_, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)

		gotTestNS, ok := request.NamespaceFrom(client.gotTestCtx)
		require.True(t, ok)
		assert.Equal(t, req.Namespace, gotTestNS)
		gotAuthNS, ok := request.NamespaceFrom(client.gotAuthCtx)
		require.True(t, ok)
		assert.Equal(t, req.Namespace, gotAuthNS)
	})
}

func TestAuthenticateValidatesNamespace(t *testing.T) {
	svc := newTestService(&fakeExchanger{})
	client := &mockClient{name: "should-not-run", testResult: true}
	svc.RegisterClient(client)

	for name, req := range map[string]*authnv1.AuthenticateRequest{
		"nil request":     nil,
		"empty namespace": {HttpHeaders: map[string]string{"X-Access-Token": "some-token"}},
	} {
		t.Run(name, func(t *testing.T) {
			resp, err := svc.Authenticate(context.Background(), req)
			require.ErrorIs(t, err, errExpectedNamespace)
			require.NotNil(t, resp)
			assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		})
	}
	assert.Nil(t, client.gotTestCtx)
	assert.Nil(t, client.gotAuthCtx)
}

func TestSuccessfulAuthenticationRunsHooksAndExchanges(t *testing.T) {
	req := &authnv1.AuthenticateRequest{Namespace: "stacks-1234"}

	t.Run("identity exchange happens after every post-auth hook", func(t *testing.T) {
		events := make([]string, 0, 4)
		exchanger := &fakeExchanger{
			token:  "obo-token",
			onCall: func() { events = append(events, "exchange") },
		}
		svc := newTestService(exchanger)
		result := successfulResult()
		result.RequestHeaders = map[string]string{"X-Static-Header": "static"}
		result.ResolveRequestHeaders = func(context.Context) map[string]string {
			events = append(events, "headers")
			assert.Equal(t, "Enriched Name", result.Identity.Name)
			return map[string]string{"X-Grafana-OAuth-Access-Token": "oauth-token"}
		}
		hookCalls := 0
		svc.RegisterPostAuthHook(func(_ context.Context, ident *grafanaauthn.Identity, authReq *grafanaauthn.Request) error {
			hookCalls++
			events = append(events, "hook")
			assert.Same(t, result.Identity, ident)
			assert.Same(t, result.Request, authReq)
			ident.Name = "Enriched Name"
			return nil
		})
		client := &mockClient{
			name:       "session",
			testResult: true,
			authResult: result,
			onComplete: func(status CompletionStatus) {
				events = append(events, "complete")
				assert.Equal(t, CompletionStatusOK, status)
			},
		}
		svc.RegisterClient(client)

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, resp.Code)
		assert.Equal(t, 1, hookCalls)
		assert.Equal(t, "Bearer obo-token", resp.RequestHeaders["X-Access-Token"])
		assert.Equal(t, "Bearer obo-token", resp.RequestHeaders["Authorization"])
		assert.Equal(t, "oauth-token", resp.RequestHeaders["X-Grafana-OAuth-Access-Token"])
		assert.Equal(t, "static", resp.RequestHeaders["X-Static-Header"])
		assert.Equal(t, []string{"hook", "exchange", "headers", "complete"}, events)
		assert.Equal(t, []CompletionStatus{CompletionStatusOK}, client.completions)
		require.NotNil(t, exchanger.lastReq.Subject)
		assert.Empty(t, exchanger.lastReq.SubjectToken)
		assert.Equal(t, "user:1", exchanger.lastReq.Subject.Sub)
		assert.Equal(t, "user-uid", exchanger.lastReq.Subject.Identifier)
		assert.Equal(t, "Enriched Name", exchanger.lastReq.Subject.DisplayName)
		assert.Equal(t, req.Namespace, exchanger.lastReq.Subject.Namespace)
		assert.Equal(t, []string{"aud-one", "aud-two"}, exchanger.lastReq.Audiences)
	})

	t.Run("subject-token result overrides identity exchange", func(t *testing.T) {
		exchanger := &fakeExchanger{token: "obo-token"}
		svc := newTestService(exchanger)
		result := successfulResult()
		result.SubjectToken = "verified-id-token"
		hookCalls := 0
		svc.RegisterPostAuthHook(func(_ context.Context, ident *grafanaauthn.Identity, authReq *grafanaauthn.Request) error {
			hookCalls++
			assert.Same(t, result.Identity, ident)
			assert.Same(t, result.Request, authReq)
			return nil
		})
		svc.RegisterClient(&mockClient{name: "ext_jwt", testResult: true, authResult: result})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, resp.Code)
		assert.Equal(t, 1, hookCalls)
		assert.Equal(t, "verified-id-token", exchanger.lastReq.SubjectToken)
		assert.Nil(t, exchanger.lastReq.Subject)
	})

	t.Run("hook failure fails closed before exchange", func(t *testing.T) {
		exchanger := &fakeExchanger{}
		svc := newTestService(exchanger)
		svc.RegisterPostAuthHook(func(context.Context, *grafanaauthn.Identity, *grafanaauthn.Request) error {
			return errors.New("hook failed")
		})
		result := successfulResult()
		headerCalls := 0
		result.ResolveRequestHeaders = func(context.Context) map[string]string {
			headerCalls++
			return nil
		}
		client := &mockClient{name: "ext_jwt", testResult: true, authResult: result}
		svc.RegisterClient(client)

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		assertUnauthorizedBody(t, resp.ResponseBody)
		assert.Zero(t, exchanger.calls)
		assert.Zero(t, headerCalls)
		assert.Equal(t, []CompletionStatus{CompletionStatusPostAuthHookFailed}, client.completions)
	})

	t.Run("disabled identity fails closed after hooks", func(t *testing.T) {
		exchanger := &fakeExchanger{}
		svc := newTestService(exchanger)
		result := successfulResult()
		result.Identity.IsDisabled = true
		client := &mockClient{name: "session", testResult: true, authResult: result}
		svc.RegisterClient(client)

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		assertUnauthorizedBody(t, resp.ResponseBody)
		assert.Zero(t, exchanger.calls)
		assert.Equal(t, []CompletionStatus{CompletionStatusIdentityDisabled}, client.completions)
	})

	t.Run("exchange failure is returned as FAILED", func(t *testing.T) {
		svc := newTestService(&fakeExchanger{err: errors.New("exchange failed")})
		result := successfulResult()
		headerCalls := 0
		result.ResolveRequestHeaders = func(context.Context) map[string]string {
			headerCalls++
			return nil
		}
		client := &mockClient{name: "session", testResult: true, authResult: result}
		svc.RegisterClient(client)

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		assertUnauthorizedBody(t, resp.ResponseBody)
		assert.Zero(t, headerCalls)
		assert.Equal(t, []CompletionStatus{CompletionStatusTokenExchangeFailed}, client.completions)
	})

	t.Run("successful result requires identity and hook request", func(t *testing.T) {
		for name, result := range map[string]*AuthenticationResult{
			"missing identity": {Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, Request: &grafanaauthn.Request{}},
			"missing request":  {Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, Identity: successfulResult().Identity},
		} {
			t.Run(name, func(t *testing.T) {
				svc := newTestService(&fakeExchanger{})
				client := &mockClient{name: "broken", testResult: true, authResult: result}
				svc.RegisterClient(client)

				resp, err := svc.Authenticate(context.Background(), req)
				require.ErrorIs(t, err, errExpectedAuthenticationResult)
				assert.Nil(t, resp)
				assert.Equal(t, []CompletionStatus{CompletionStatusInternalError}, client.completions)
			})
		}
	})
}

func TestRegisterClient(t *testing.T) {
	svc := newTestService(&fakeExchanger{})
	assert.Empty(t, svc.clients)

	svc.RegisterClient(&mockClient{name: "first"})
	svc.RegisterClient(&mockClient{name: "second"})

	require.Len(t, svc.clients, 2)
	assert.Equal(t, "first", svc.clients[0].Name())
	assert.Equal(t, "second", svc.clients[1].Name())
}

func TestAuthenticateGRPCLogFields(t *testing.T) {
	extractFieldMap := func(ctx context.Context) map[string]string {
		fields := make(map[string]string)
		it := grpclog.ExtractFields(ctx).Iterator()
		for it.Next() {
			key, value := it.At()
			fields[key] = value.(string)
		}
		return fields
	}

	t.Run("OK includes client, code, namespace, and header names", func(t *testing.T) {
		svc := newTestService(&fakeExchanger{token: "token"})
		svc.RegisterClient(&mockClient{name: "ext_jwt", testResult: true, authResult: successfulResult()})
		ctx := grpclog.InjectFields(t.Context(), grpclog.Fields{})

		_, err := svc.Authenticate(ctx, &authnv1.AuthenticateRequest{
			Namespace:   "stacks-123",
			HttpHeaders: map[string]string{"Authorization": "Bearer xxx", "X-Grafana-Id": "id-token"},
		})
		require.NoError(t, err)

		fields := extractFieldMap(ctx)
		assert.Equal(t, "ext_jwt", fields["authn.client"])
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK.String(), fields["authn.code"])
		assert.Equal(t, "stacks-123", fields["authn.namespace"])
		assert.Equal(t, "Authorization,X-Grafana-Id", fields["authn.headers"])
	})

	t.Run("no match includes none and NOT_HANDLED", func(t *testing.T) {
		svc := newTestService(&fakeExchanger{})
		svc.RegisterClient(&mockClient{name: "ext_jwt", testResult: false})
		ctx := grpclog.InjectFields(t.Context(), grpclog.Fields{})

		_, err := svc.Authenticate(ctx, &authnv1.AuthenticateRequest{Namespace: "stacks-123"})
		require.NoError(t, err)

		fields := extractFieldMap(ctx)
		assert.Equal(t, "none", fields["authn.client"])
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED.String(), fields["authn.code"])
		assert.Equal(t, "", fields["authn.headers"])
	})

	t.Run("client error includes client and namespace", func(t *testing.T) {
		svc := newTestService(&fakeExchanger{})
		svc.RegisterClient(&mockClient{name: "ext_jwt", testResult: true, authError: fmt.Errorf("boom")})
		ctx := grpclog.InjectFields(t.Context(), grpclog.Fields{})

		_, err := svc.Authenticate(ctx, &authnv1.AuthenticateRequest{
			Namespace:   "stacks-456",
			HttpHeaders: map[string]string{"Authorization": "Bearer xxx"},
		})
		require.Error(t, err)

		fields := extractFieldMap(ctx)
		assert.Equal(t, "ext_jwt", fields["authn.client"])
		assert.Equal(t, "stacks-456", fields["authn.namespace"])
		assert.Equal(t, "Authorization", fields["authn.headers"])
	})
}
