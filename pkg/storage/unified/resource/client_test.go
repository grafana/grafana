package resource

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIDTokenExtractor(t *testing.T) {
	t.Run("should return an error when no claims found", func(t *testing.T) {
		token, err := IDTokenExtractor(context.Background())
		assert.Error(t, err)
		assert.Empty(t, token)
	})
	t.Run("should return an empty token when grafana identity is set", func(t *testing.T) {
		ctx, _ := identity.WithServiceIdentity(context.Background(), 0)
		token, err := IDTokenExtractor(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})
}

func TestNewIDTokenExtractor(t *testing.T) {
	serviceCtx, _ := identity.WithServiceIdentity(context.Background(), 0)
	withInfo := func(info *identity.StaticRequester) context.Context {
		return types.WithAuthInfo(context.Background(), info)
	}
	requireIdentity := func(context.Context) bool { return true }

	for _, tc := range []struct {
		name      string
		cfg       RemoteResourceClientConfig
		ctx       context.Context
		wantMode  string
		wantToken string
		wantCode  codes.Code
	}{
		{
			name:     "internal service identity",
			ctx:      serviceCtx,
			wantMode: identityModeService,
		},
		{
			name:     "access policy calling on its own behalf",
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeAccessPolicy}),
			wantMode: identityModeService,
		},
		{
			name:      "user with an id token",
			ctx:       withInfo(&identity.StaticRequester{Type: types.TypeUser, IDToken: "id-token"}),
			wantMode:  identityModeIDToken,
			wantToken: "id-token",
		},
		{
			name:     "user on a client whose exchanger carries the caller",
			cfg:      RemoteResourceClientConfig{CarriesCallerIdentity: true, RequireCallerIdentity: requireIdentity},
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser}),
			wantMode: identityModeOnBehalfOf,
		},
		{
			name:     "user with nothing to forward falls back to the service",
			cfg:      RemoteResourceClientConfig{RequireCallerIdentity: func(context.Context) bool { return false }},
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser}),
			wantMode: identityModeFallbackService,
		},
		{
			name:     "an unset policy defers to the flag, which defaults off",
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser}),
			wantMode: identityModeFallbackService,
		},
		{
			name:     "user with nothing to forward is denied when the fallback is off",
			cfg:      RemoteResourceClientConfig{RequireCallerIdentity: requireIdentity},
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser}),
			wantMode: identityModeDenied,
			wantCode: codes.PermissionDenied,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := testutil.ToFloat64(clientIdentityTotal.WithLabelValues(tc.wantMode))

			token, err := newIDTokenExtractor(tc.cfg)(tc.ctx)

			assert.Equal(t, tc.wantCode, status.Code(err))
			assert.Equal(t, tc.wantToken, token)
			assert.Equal(t, before+1, testutil.ToFloat64(clientIdentityTotal.WithLabelValues(tc.wantMode)))
		})
	}
}

// The deny decision is only useful if authlib propagates it, so check the whole interceptor.
// The call must fail with `codes.PermissionDenied` and never reach the server.
func TestRemoteClientDeniesRequestsWithoutCallerIdentity(t *testing.T) {
	interceptor, err := NewAuthnGrpcClientInterceptor(noop.NewTracerProvider().Tracer(""), RemoteResourceClientConfig{
		Namespace:             "stacks-1",
		Audiences:             []string{"resourceStore"},
		TokenExchanger:        ProvideInProcExchanger(),
		RequireCallerIdentity: func(context.Context) bool { return true },
	})
	require.NoError(t, err)

	ctx := types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeUser})
	invoked := false
	err = interceptor.UnaryClientInterceptor(ctx, "/resource.ResourceStore/List", nil, nil, nil,
		func(context.Context, string, any, any, *grpc.ClientConn, ...grpc.CallOption) error {
			invoked = true
			return nil
		})

	assert.Equal(t, codes.PermissionDenied, status.Code(err))
	assert.False(t, invoked, "the request must not reach storage")
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
