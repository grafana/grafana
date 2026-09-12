package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestNewIDTokenExtractor(t *testing.T) {
	userWithoutIDToken := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:    types.TypeUser,
		UserID:  505,
		UserUID: "scim-fepx3rxnpfif4c",
	})

	t.Run("should return an error when no claims found", func(t *testing.T) {
		token, err := newIDTokenExtractor(false)(context.Background())
		assert.Error(t, err)
		assert.Empty(t, token)
	})

	t.Run("should return an empty token when grafana identity is set", func(t *testing.T) {
		ctx, _ := identity.WithServiceIdentity(context.Background(), 0)
		token, err := newIDTokenExtractor(false)(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})

	t.Run("an unscoped credential refuses a user that has no id token", func(t *testing.T) {
		_, err := newIDTokenExtractor(true)(userWithoutIDToken)
		require.Error(t, err, "a user must not be downgraded to a credential that spans every tenant")
		assert.Equal(t, codes.PermissionDenied, status.Code(err), "must surface as 403 rather than 500")
	})

	t.Run("a tenant-scoped credential still carries such a user", func(t *testing.T) {
		token, err := newIDTokenExtractor(false)(userWithoutIDToken)
		require.NoError(t, err)
		assert.Empty(t, token)
	})

	t.Run("an unscoped credential propagates the id token when there is one", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:    types.TypeUser,
			UserUID: "u1",
			IDToken: "id-token",
		})

		token, err := newIDTokenExtractor(true)(ctx)
		require.NoError(t, err)
		assert.Equal(t, "id-token", token)
	})

	t.Run("an unscoped credential still allows the service identity", func(t *testing.T) {
		ctx, _ := identity.WithServiceIdentity(context.Background(), 0)

		token, err := newIDTokenExtractor(true)(ctx)
		require.NoError(t, err)
		assert.Empty(t, token)
	})
}

func TestNewAuthnGrpcClientInterceptorIDTokenPolicy(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("")
	userWithoutIDToken := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:      types.TypeUser,
		UserUID:   "u1",
		Namespace: "stacks-11",
	})

	// Drive the real interceptor: the call either reaches the invoker or is refused
	// before it. reached reports which.
	call := func(t *testing.T, cfg RemoteResourceClientConfig) (reached bool, err error) {
		t.Helper()
		cfg.TokenExchanger = ProvideInProcExchanger()
		cfg.Audiences = []string{"resourceStore"}
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, cfg)
		require.NoError(t, err)

		invoker := func(context.Context, string, any, any, *grpc.ClientConn, ...grpc.CallOption) error {
			reached = true
			return nil
		}
		err = interceptor.UnaryClientInterceptor(userWithoutIDToken, "/Test/Call", nil, nil, nil, invoker)
		return reached, err
	}

	t.Run("a wildcard client refuses a user without an id token", func(t *testing.T) {
		reached, err := call(t, RemoteResourceClientConfig{Namespace: namespaceWildcard})
		assert.False(t, reached, "the RPC must not go out")
		assert.Equal(t, codes.PermissionDenied, status.Code(err))
	})

	t.Run("a wildcard client whose exchanger scopes per request still carries the user", func(t *testing.T) {
		reached, err := call(t, RemoteResourceClientConfig{
			Namespace:                     namespaceWildcard,
			PerRequestCredentialNamespace: true,
		})
		require.NoError(t, err, "the exchanger scopes the credential to the caller's tenant, so there is nothing to refuse")
		assert.True(t, reached, "the RPC must go out")
	})
}

func TestNewAuthnGrpcClientInterceptor(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("")

	t.Run("empty token exchange url in dev falls back to the in-proc exchanger", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace: "*",
			Audiences: []string{"resourceStore"},
			IsDev:     true,
		})
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})

	t.Run("empty token exchange url outside dev is a misconfiguration", func(t *testing.T) {
		_, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace: "*",
			Audiences: []string{"resourceStore"},
			IsDev:     false,
		})
		require.Error(t, err, "must not silently self-mint tokens outside dev mode")
	})

	t.Run("an explicit TokenExchanger is used regardless of dev mode", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace:      "*",
			Audiences:      []string{"resourceStore"},
			IsDev:          false,
			TokenExchanger: ProvideInProcExchanger(),
		})
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})

	t.Run("a token exchange url builds a real exchange client outside dev", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Token:            "some-token",
			TokenExchangeURL: "https://example.com/token",
			Namespace:        "*",
			Audiences:        []string{"resourceStore"},
			IsDev:            false,
		})
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})
}
