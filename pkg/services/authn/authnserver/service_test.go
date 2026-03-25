package authnserver

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authnv1 "github.com/grafana/authlib/authn/proto/v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

type mockClient struct {
	name         string
	testResult   bool
	authResponse *authnv1.AuthenticateResponse
	authError    error
}

func (m *mockClient) Name() string { return m.name }

func (m *mockClient) Test(_ context.Context, _ *authnv1.AuthenticateRequest) bool {
	return m.testResult
}

func (m *mockClient) Authenticate(_ context.Context, _ *authnv1.AuthenticateRequest) (*authnv1.AuthenticateResponse, error) {
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
