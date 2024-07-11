package idimpl

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/idtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

func Test_ProvideService(t *testing.T) {
	t.Run("should register post auth hook when feature flag is enabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures(featuremgmt.FlagIdForwarding)

		var hookRegistered bool
		authnService := &authntest.MockService{
			RegisterPostAuthHookFunc: func(_ authn.PostAuthHookFn, _ uint) {
				hookRegistered = true
			},
		}

		_ = ProvideService(setting.NewCfg(), nil, nil, features, authnService, nil)
		assert.True(t, hookRegistered)
	})

	t.Run("should not register post auth hook when feature flag is disabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures()

		var hookRegistered bool
		authnService := &authntest.MockService{
			RegisterPostAuthHookFunc: func(_ authn.PostAuthHookFn, _ uint) {
				hookRegistered = true
			},
		}

		_ = ProvideService(setting.NewCfg(), nil, nil, features, authnService, nil)
		assert.False(t, hookRegistered)
	})
}

func TestService_SignIdentity(t *testing.T) {
	signer := &idtest.MockSigner{
		SignIDTokenFn: func(_ context.Context, claims *auth.IDClaims) (string, error) {
			key := []byte("key")
			s, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: key}, nil)
			require.NoError(t, err)

			token, err := jwt.Signed(s).Claims(claims.Claims).Claims(claims.Rest).CompactSerialize()
			require.NoError(t, err)

			return token, nil
		},
	}

	t.Run("should sign identity", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			featuremgmt.WithFeatures(featuremgmt.FlagIdForwarding),
			&authntest.FakeService{}, nil,
		)
		token, err := s.SignIdentity(context.Background(), &authn.Identity{ID: authn.MustParseNamespaceID("user:1")})
		require.NoError(t, err)
		require.NotEmpty(t, token)
	})

	t.Run("should sign identity with authenticated by if user is externally authenticated", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			featuremgmt.WithFeatures(featuremgmt.FlagIdForwarding),
			&authntest.FakeService{}, nil,
		)
		token, err := s.SignIdentity(context.Background(), &authn.Identity{
			ID:              authn.MustParseNamespaceID("user:1"),
			AuthenticatedBy: login.AzureADAuthModule,
			Login:           "U1",
			UID:             authn.NewNamespaceIDString(authn.NamespaceUser, "edpu3nnt61se8e")})
		require.NoError(t, err)

		parsed, err := jwt.ParseSigned(token)
		require.NoError(t, err)

		claims := &auth.IDClaims{}
		require.NoError(t, parsed.UnsafeClaimsWithoutVerification(&claims.Claims, &claims.Rest))
		assert.Equal(t, login.AzureADAuthModule, claims.Rest.AuthenticatedBy)
		assert.Equal(t, "U1", claims.Rest.Username)
		assert.Equal(t, "user:edpu3nnt61se8e", claims.Rest.UID)
	})
}
