package authnserver

import (
	"context"
	"errors"
	"fmt"
	"testing"

	grpclog "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	authnv1 "github.com/grafana/authlib/authn/proto/v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

type mockClient struct {
	name         string
	testResult   bool
	authResponse *authnv1.AuthenticateResponse
	authError    error

	gotTestCtx context.Context
	gotAuthCtx context.Context
}

func (m *mockClient) Name() string { return m.name }

func (m *mockClient) Test(ctx context.Context, _ *authnv1.AuthenticateRequest) bool {
	m.gotTestCtx = ctx
	return m.testResult
}

func (m *mockClient) Authenticate(ctx context.Context, _ *authnv1.AuthenticateRequest) (*authnv1.AuthenticateResponse, error) {
	m.gotAuthCtx = ctx
	return m.authResponse, m.authError
}

func TestAuthenticate(t *testing.T) {
	req := &authnv1.AuthenticateRequest{
		Namespace:   "stacks-1234",
		HttpHeaders: map[string]string{"X-Access-Token": "some-token"},
	}

	t.Run("no clients registered returns NOT_HANDLED", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED, resp.Code)
	})

	t.Run("single client Test true and returns OK", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "test-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "bespoke-token",
			},
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, resp.Code)
		assert.Equal(t, "bespoke-token", resp.Token)
	})

	t.Run("single client Test false returns NOT_HANDLED", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "test-client",
			testResult: false,
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED, resp.Code)
	})

	t.Run("client returns FAILED with no fallthrough", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "failing-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED,
			},
		})
		svc.RegisterClient(&mockClient{
			name:       "backup-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "should-not-reach",
			},
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
	})

	t.Run("client returns NOT_HANDLED mid-auth falls through to next", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "declining-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED,
			},
		})
		svc.RegisterClient(&mockClient{
			name:       "handling-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "handled",
			},
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, resp.Code)
		assert.Equal(t, "handled", resp.Token)
	})

	t.Run("multiple clients first declines via Test second handles", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "skipped-client",
			testResult: false,
		})
		svc.RegisterClient(&mockClient{
			name:       "active-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "from-second",
			},
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK, resp.Code)
		assert.Equal(t, "from-second", resp.Token)
	})

	t.Run("client returning error propagates without fallthrough", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "error-client",
			testResult: true,
			authError:  fmt.Errorf("internal failure"),
		})
		svc.RegisterClient(&mockClient{
			name:       "backup-client",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "should-not-reach",
			},
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "internal failure")
	})

	t.Run("nil request returns FAILED with errExpectedNamespace", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		client := &mockClient{name: "should-not-run", testResult: true}
		svc.RegisterClient(client)

		resp, err := svc.Authenticate(context.Background(), nil)
		require.Error(t, err)
		assert.True(t, errors.Is(err, errExpectedNamespace))
		require.NotNil(t, resp)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		assert.Nil(t, client.gotTestCtx, "clients must not be dispatched when namespace is missing")
		assert.Nil(t, client.gotAuthCtx)
	})

	t.Run("empty namespace returns FAILED with errExpectedNamespace", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		client := &mockClient{name: "should-not-run", testResult: true}
		svc.RegisterClient(client)

		emptyNS := &authnv1.AuthenticateRequest{
			Namespace:   "",
			HttpHeaders: map[string]string{"X-Access-Token": "some-token"},
		}
		resp, err := svc.Authenticate(context.Background(), emptyNS)
		require.Error(t, err)
		assert.True(t, errors.Is(err, errExpectedNamespace))
		require.NotNil(t, resp)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED, resp.Code)
		assert.Nil(t, client.gotTestCtx, "clients must not be dispatched when namespace is empty")
		assert.Nil(t, client.gotAuthCtx)
	})

	t.Run("namespace from request is propagated into client context", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		client := &mockClient{
			name:       "ns-capture",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "ok",
			},
		}
		svc.RegisterClient(client)

		_, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)

		require.NotNil(t, client.gotTestCtx)
		gotTestNS, ok := request.NamespaceFrom(client.gotTestCtx)
		require.True(t, ok, "namespace must be set on Test ctx")
		assert.Equal(t, "stacks-1234", gotTestNS)

		require.NotNil(t, client.gotAuthCtx)
		gotAuthNS, ok := request.NamespaceFrom(client.gotAuthCtx)
		require.True(t, ok, "namespace must be set on Authenticate ctx")
		assert.Equal(t, "stacks-1234", gotAuthNS)
	})

	t.Run("all clients decline via NOT_HANDLED returns NOT_HANDLED", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "client-a",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED,
			},
		})
		svc.RegisterClient(&mockClient{
			name:       "client-b",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED,
			},
		})

		resp, err := svc.Authenticate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED, resp.Code)
	})
}

func TestRegisterClient(t *testing.T) {
	svc := NewService(tracing.InitializeTracerForTest())
	assert.Empty(t, svc.clients)

	svc.RegisterClient(&mockClient{name: "first"})
	assert.Len(t, svc.clients, 1)

	svc.RegisterClient(&mockClient{name: "second"})
	assert.Len(t, svc.clients, 2)
	assert.Equal(t, "first", svc.clients[0].Name())
	assert.Equal(t, "second", svc.clients[1].Name())
}

func TestAuthenticate_GRPCLogFields(t *testing.T) {
	grpcCtx := func(ctx context.Context) context.Context {
		return grpclog.InjectFields(ctx, grpclog.Fields{})
	}

	// gRPC log fields are stored as alternating (key, value, key, value, ...)
	// in a flat []any slice. This helper converts it to a map to simplify assertions.
	extractFieldMap := func(ctx context.Context) map[string]string {
		m := make(map[string]string)
		it := grpclog.ExtractFields(ctx).Iterator()
		for it.Next() {
			k, v := it.At()
			m[k] = v.(string)
		}
		return m
	}

	t.Run("OK injects client, code, namespace, and headers", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "ext_jwt",
			testResult: true,
			authResponse: &authnv1.AuthenticateResponse{
				Code:  authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
				Token: "tok",
			},
		})

		ctx := grpcCtx(t.Context())
		req := &authnv1.AuthenticateRequest{
			Namespace:   "stacks-123",
			HttpHeaders: map[string]string{"Authorization": "Bearer xxx", "X-Grafana-Id": "id-token"},
		}

		_, err := svc.Authenticate(ctx, req)
		require.NoError(t, err)

		fields := extractFieldMap(ctx)
		assert.Equal(t, "ext_jwt", fields["authn.client"])
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK.String(), fields["authn.code"])
		assert.Equal(t, "stacks-123", fields["authn.namespace"])
		assert.Equal(t, "Authorization,X-Grafana-Id", fields["authn.headers"])
	})

	t.Run("no match injects none client and NOT_HANDLED code", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{name: "ext_jwt", testResult: false})

		ctx := grpcCtx(t.Context())
		req := &authnv1.AuthenticateRequest{Namespace: "stacks-123"}

		_, err := svc.Authenticate(ctx, req)
		require.NoError(t, err)

		fields := extractFieldMap(ctx)
		assert.Equal(t, "none", fields["authn.client"])
		assert.Equal(t, authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED.String(), fields["authn.code"])
		assert.Equal(t, "", fields["authn.headers"])
	})

	t.Run("error injects client and namespace", func(t *testing.T) {
		svc := NewService(tracing.InitializeTracerForTest())
		svc.RegisterClient(&mockClient{
			name:       "ext_jwt",
			testResult: true,
			authError:  fmt.Errorf("boom"),
		})

		ctx := grpcCtx(t.Context())
		req := &authnv1.AuthenticateRequest{
			Namespace:   "stacks-456",
			HttpHeaders: map[string]string{"Authorization": "Bearer xxx"},
		}

		_, err := svc.Authenticate(ctx, req)
		require.Error(t, err)

		fields := extractFieldMap(ctx)
		assert.Equal(t, "ext_jwt", fields["authn.client"])
		assert.Equal(t, "stacks-456", fields["authn.namespace"])
		assert.Equal(t, "Authorization", fields["authn.headers"])
	})
}
