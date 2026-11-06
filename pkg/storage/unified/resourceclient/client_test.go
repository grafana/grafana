package resourceclient

import (
	"context"
	"testing"
	"time"

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
	embedded := ModeEmbedded.policy()
	standalone := ModeStandalone.policy()
	cancelledCtx, cancel := context.WithCancel(withInfo(&identity.StaticRequester{Type: types.TypeUser}))
	cancel()
	expiredCtx, cancelExpired := context.WithDeadline(withInfo(&identity.StaticRequester{Type: types.TypeUser}), time.Now().Add(-time.Minute))
	defer cancelExpired()

	modes := []string{identityModeService, identityModeIDToken, identityModeOnBehalfOf, identityModeFallbackService, identityModeDenied, identityModeCancelled}
	counts := func() map[string]float64 {
		out := make(map[string]float64, len(modes))
		for _, mode := range modes {
			out[mode] = testutil.ToFloat64(clientIdentityTotal.WithLabelValues(mode))
		}
		return out
	}

	for _, tc := range []struct {
		name      string
		policy    identityPolicy
		ctx       context.Context
		wantMode  string
		wantToken string
		wantCode  codes.Code
	}{
		{
			name:     "internal service identity",
			policy:   standalone,
			ctx:      serviceCtx,
			wantMode: identityModeService,
		},
		{
			name:     "access policy calling on its own behalf",
			policy:   standalone,
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeAccessPolicy}),
			wantMode: identityModeService,
		},
		{
			name:      "user with an id token",
			policy:    standalone,
			ctx:       withInfo(&identity.StaticRequester{Type: types.TypeUser, IDToken: "id-token"}),
			wantMode:  identityModeIDToken,
			wantToken: "id-token",
		},
		{
			name:     "embedded client falls back to the service for a user with nothing to forward",
			policy:   embedded,
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser}),
			wantMode: identityModeFallbackService,
		},
		{
			name:     "standalone client denies a user with nothing to forward",
			policy:   standalone,
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser}),
			wantMode: identityModeDenied,
			wantCode: codes.PermissionDenied,
		},
		{
			name:     "cancelled user request without an id token is neither a fallback nor a denial",
			policy:   standalone,
			ctx:      cancelledCtx,
			wantMode: identityModeCancelled,
			wantCode: codes.Canceled,
		},
		{
			name:     "cancelled user request is not counted as a fallback when the fallback is allowed",
			policy:   embedded,
			ctx:      cancelledCtx,
			wantMode: identityModeCancelled,
			wantCode: codes.Canceled,
		},
		{
			name:     "user request past its deadline is not counted as a fallback",
			policy:   embedded,
			ctx:      expiredCtx,
			wantMode: identityModeCancelled,
			wantCode: codes.DeadlineExceeded,
		},
		{
			name:     "user carried inside the access token goes obo",
			policy:   standalone,
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser, AccessToken: userActorToken(t)}),
			wantMode: identityModeOnBehalfOf,
		},
		{
			// The exchanger carries the caller inside the exchanged token, so the ID token
			// must stay home: pure obo.
			name:     "obo takes priority over a present id token",
			policy:   embedded,
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser, AccessToken: userActorToken(t), IDToken: "id-token"}),
			wantMode: identityModeOnBehalfOf,
		},
		{
			name:      "obo policy off keeps the classic id token transport",
			policy:    identityPolicy{},
			ctx:       withInfo(&identity.StaticRequester{Type: types.TypeUser, AccessToken: userActorToken(t), IDToken: "id-token"}),
			wantMode:  identityModeIDToken,
			wantToken: "id-token",
		},
		{
			name:     "an access token that does not carry the user is not obo",
			policy:   embedded,
			ctx:      withInfo(&identity.StaticRequester{Type: types.TypeUser, AccessToken: serviceActorToken(t)}),
			wantMode: identityModeFallbackService,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			want := counts()
			want[tc.wantMode]++

			token, err := newIDTokenExtractor(tc.policy)(tc.ctx)

			assert.Equal(t, tc.wantCode, status.Code(err))
			assert.Equal(t, tc.wantToken, token)
			assert.Equal(t, want, counts(), "only the %s counter should move", tc.wantMode)
		})
	}
}

// The deny decision is only useful if authlib propagates it, so check the whole interceptor.
// The call must fail with `codes.PermissionDenied` and never reach the server.
func TestRemoteClientDeniesRequestsWithoutCallerIdentity(t *testing.T) {
	interceptor, err := NewAuthnGrpcClientInterceptor(noop.NewTracerProvider().Tracer(""), RemoteResourceClientConfig{
		Namespace:      "stacks-1",
		Audiences:      []string{"resourceStore"},
		TokenExchanger: ProvideInProcExchanger(),
	}, ModeStandalone)
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
		}, ModeEmbedded)
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})

	t.Run("empty token exchange url outside dev is a misconfiguration", func(t *testing.T) {
		_, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace: "*",
			Audiences: []string{"resourceStore"},
			IsDev:     false,
		}, ModeEmbedded)
		require.Error(t, err, "must not silently self-mint tokens outside dev mode")
	})

	t.Run("an explicit TokenExchanger is used regardless of dev mode", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace:      "*",
			Audiences:      []string{"resourceStore"},
			IsDev:          false,
			TokenExchanger: ProvideInProcExchanger(),
		}, ModeStandalone)
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
		}, ModeStandalone)
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})
}
