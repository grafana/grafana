package idimpl

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"testing"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/idtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
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

		_ = ProvideService(setting.NewCfg(), nil, nil, authnService, nil, tracing.InitializeTracerForTest())
		assert.True(t, hookRegistered)
	})
}

var testKey = decodePrivateKey([]byte(`
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEID6lXWsmcv/UWn9SptjOThsy88cifgGIBj2Lu0M9I8tQoAoGCCqGSM49
AwEHoUQDQgAEsf6eNnNMNhl+q7jXsbdUf3ADPh248uoFUSSV9oBzgptyokHCjJz6
n6PKDm2W7i3S2+dAs5M5f3s7d8KiLjGZdQ==
-----END EC PRIVATE KEY-----
`))

func decodePrivateKey(data []byte) *ecdsa.PrivateKey {
	block, _ := pem.Decode(data)
	if block == nil {
		panic("should include PEM block")
	}

	privateKey, err := x509.ParseECPrivateKey(block.Bytes)
	if err != nil {
		panic(fmt.Sprintf("should be able to parse ec private key: %v", err))

	}
	if privateKey.Curve.Params().Name != "P-256" {
		panic("should be valid private key")
	}

	return privateKey
}

func TestService_SignIdentity(t *testing.T) {
	signer := &idtest.FakeSigner{
		SignIDTokenFn: func(_ context.Context, claims *auth.IDClaims) (string, error) {
			s, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: testKey}, nil)
			require.NoError(t, err)

			token, err := jwt.Signed(s).Claims(claims.Claims).Claims(claims.Rest).Serialize()
			require.NoError(t, err)

			return token, nil
		},
	}

	t.Run("should sign identity", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)
		token, _, err := s.SignIdentity(context.Background(), &authn.Identity{ID: "1", Type: claims.TypeUser})
		require.NoError(t, err)
		require.NotEmpty(t, token)
	})

	t.Run("should sign identity with authenticated by if user is externally authenticated", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)
		token, _, err := s.SignIdentity(context.Background(), &authn.Identity{
			ID:              "1",
			Type:            claims.TypeUser,
			AuthenticatedBy: login.AzureADAuthModule,
			Login:           "U1",
			UID:             "edpu3nnt61se8e",
		})
		require.NoError(t, err)

		parsed, err := jwt.ParseSigned(token, []jose.SignatureAlgorithm{jose.ES256})
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
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
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

	t.Run("should sign new token if org role has changed", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)

		ident := &authn.Identity{
			ID:              "1",
			Type:            claims.TypeUser,
			AuthenticatedBy: login.AzureADAuthModule,
			Login:           "U1",
			UID:             "edpu3nnt61se8e",
			OrgID:           1,
			OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
		}

		first, _, err := s.SignIdentity(context.Background(), ident)
		require.NoError(t, err)

		second, _, err := s.SignIdentity(context.Background(), ident)
		require.NoError(t, err)

		assert.Equal(t, first, second)

		ident.OrgRoles[1] = org.RoleEditor
		third, _, err := s.SignIdentity(context.Background(), ident)
		require.NoError(t, err)
		assert.NotEqual(t, first, third)
	})
}
