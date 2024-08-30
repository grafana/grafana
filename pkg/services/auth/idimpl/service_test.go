package idimpl

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/idtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

func Test_ProvideService(t *testing.T) {
	t.Run("should register post auth hook", func(t *testing.T) {
		var hookRegistered bool
		authnService := &authntest.MockService{
			RegisterPostAuthHookFunc: func(_ authn.PostAuthHookFn, _ uint) {
				hookRegistered = true
			},
		}

		_ = ProvideService(setting.NewCfg(), nil, nil, authnService, nil)
		assert.True(t, hookRegistered)
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
			&authntest.FakeService{}, nil,
		)
		token, _, err := s.SignIdentity(context.Background(), &authn.Identity{ID: "1", Type: claims.TypeUser})
		require.NoError(t, err)
		require.NotEmpty(t, token)
	})

	t.Run("should sign identity with authenticated by if user is externally authenticated", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil,
		)
		token, _, err := s.SignIdentity(context.Background(), &authn.Identity{
			ID:              "1",
			Type:            claims.TypeUser,
			AuthenticatedBy: login.AzureADAuthModule,
			Login:           "U1",
			UID:             "edpu3nnt61se8e",
		})
		require.NoError(t, err)

		parsed, err := jwt.ParseSigned(token)
		require.NoError(t, err)

		gotClaims := &auth.IDClaims{}
		require.NoError(t, parsed.UnsafeClaimsWithoutVerification(&gotClaims.Claims, &gotClaims.Rest))
		assert.Equal(t, login.AzureADAuthModule, gotClaims.Rest.AuthenticatedBy)
		assert.Equal(t, "U1", gotClaims.Rest.Username)
		assert.Equal(t, claims.TypeUser, gotClaims.Rest.Type)
		assert.Equal(t, "edpu3nnt61se8e", gotClaims.Rest.Identifier)
	})

	t.Run("should sign identity with authenticated by if user is externally authenticated", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil,
		)
		_, gotClaims, err := s.SignIdentity(context.Background(), &authn.Identity{
			ID:              "1",
			Type:            claims.TypeUser,
			AuthenticatedBy: login.AzureADAuthModule,
			Login:           "U1",
			UID:             "edpu3nnt61se8e",
		})
		require.NoError(t, err)

		assert.Equal(t, login.AzureADAuthModule, gotClaims.Rest.AuthenticatedBy)
		assert.Equal(t, "U1", gotClaims.Rest.Username)
		assert.Equal(t, claims.TypeUser, gotClaims.Rest.Type)
		assert.Equal(t, "edpu3nnt61se8e", gotClaims.Rest.Identifier)
	})
}
