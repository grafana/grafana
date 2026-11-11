package idimpl

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

	t.Run("groups claim source", func(t *testing.T) {
		ident := &authn.Identity{
			ID:             "1",
			Type:           claims.TypeUser,
			Login:          "U1",
			UID:            "edpu3nnt61se8e",
			Groups:         []string{"team-uid-1", "team-uid-2"},
			ExternalGroups: []string{"team-uid-1", "team-uid-3"},
		}

		t.Run("uses Grafana-stored groups by default", func(t *testing.T) {
			s := ProvideService(
				setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
				&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
			)

			_, gotClaims, err := s.SignIdentity(context.Background(), ident)
			require.NoError(t, err)
			assert.Equal(t, ident.Groups, gotClaims.Rest.Groups)
		})

		t.Run("uses external groups when IDUseExternalGroupsForGroupsClaim is enabled", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.IDUseExternalGroupsForGroupsClaim = true
			s := ProvideService(
				cfg, signer, remotecache.NewFakeCacheStorage(),
				&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
			)

			_, gotClaims, err := s.SignIdentity(context.Background(), ident)
			require.NoError(t, err)
			assert.Equal(t, ident.ExternalGroups, gotClaims.Rest.Groups)
		})
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

	t.Run("should not reuse a token signed for another auth module of the same user", func(t *testing.T) {
		s := ProvideService(
			setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)

		newIdent := func(authenticatedBy string) *authn.Identity {
			return &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: authenticatedBy,
				Login:           "U1",
				UID:             "edpu3nnt61se8e",
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:          []string{"team-uid-1"},
			}
		}

		// A render (e.g. a scheduled report) signs in as the user first.
		renderToken, renderClaims, err := s.SignIdentity(context.Background(), newIdent(login.RenderModule))
		require.NoError(t, err)
		assert.Equal(t, login.RenderModule, renderClaims.Rest.AuthenticatedBy)

		// The same user's browser session must get its own token, not the cached render token.
		proxyToken, proxyClaims, err := s.SignIdentity(context.Background(), newIdent(login.AuthProxyAuthModule))
		require.NoError(t, err)
		assert.NotEqual(t, renderToken, proxyToken)
		assert.Equal(t, login.AuthProxyAuthModule, proxyClaims.Rest.AuthenticatedBy)

		// Each auth module still reuses its own cached token.
		renderAgain, _, err := s.SignIdentity(context.Background(), newIdent(login.RenderModule))
		require.NoError(t, err)
		assert.Equal(t, renderToken, renderAgain)

		proxyAgain, _, err := s.SignIdentity(context.Background(), newIdent(login.AuthProxyAuthModule))
		require.NoError(t, err)
		assert.Equal(t, proxyToken, proxyAgain)
	})
	t.Run("should return error and not cache when signer fails", func(t *testing.T) {
		signErr := errors.New("failed to decode private key PEM")
		var calls int
		failing := &idtest.FakeSigner{
			SignIDTokenFn: func(_ context.Context, _ *auth.IDClaims) (string, error) {
				calls++
				return "", signErr
			},
		}
		s := ProvideService(
			setting.NewCfg(), failing, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)
		ident := &authn.Identity{ID: "1", Type: claims.TypeUser}

		token, gotClaims, err := s.SignIdentity(context.Background(), ident)
		require.ErrorIs(t, err, signErr)
		assert.Empty(t, token)
		assert.Nil(t, gotClaims)

		_, _, err = s.SignIdentity(context.Background(), ident)
		require.ErrorIs(t, err, signErr)
		assert.Equal(t, 2, calls, "failed signing must not be cached")
	})
}

func TestService_SignIdentity_UserAttributeChange(t *testing.T) {
	calls := 0
	signer := &idtest.FakeSigner{
		SignIDTokenFn: func(_ context.Context, c *auth.IDClaims) (string, error) {
			calls++
			s, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: testKey}, nil)
			require.NoError(t, err)
			return jwt.Signed(s).Claims(c.Claims).Claims(c.Rest).Serialize()
		},
	}
	s := ProvideService(
		setting.NewCfg(), signer, remotecache.NewFakeCacheStorage(),
		&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
	)
	newIdent := func(email string, verified bool) *authn.Identity {
		return &authn.Identity{
			ID: "1", Type: claims.TypeUser, OrgID: 1, AuthenticatedBy: login.PasswordAuthModule,
			Email: email, EmailVerified: verified, Login: "u1", Name: "U1",
			OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
		}
	}

	_, first, err := s.SignIdentity(context.Background(), newIdent("old@example.com", false))
	require.NoError(t, err)
	_, cached, err := s.SignIdentity(context.Background(), newIdent("old@example.com", false))
	require.NoError(t, err)
	assert.Equal(t, 1, calls, "unchanged identity should be served from the cache")
	assert.Equal(t, first.Rest.Email, cached.Rest.Email)

	_, changed, err := s.SignIdentity(context.Background(), newIdent("new@example.com", true))
	require.NoError(t, err)
	assert.Equal(t, 2, calls, "changed email must not be served from the cache")
	assert.Equal(t, "new@example.com", changed.Rest.Email)
	assert.True(t, changed.Rest.EmailVerified)
}

func TestService_IDTokenCacheDisabled(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagIdTokenCacheDisabled)

	var calls atomic.Int32
	signer := &idtest.FakeSigner{
		SignIDTokenFn: func(_ context.Context, c *auth.IDClaims) (string, error) {
			calls.Add(1)
			s, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: testKey}, nil)
			require.NoError(t, err)
			return jwt.Signed(s).Claims(c.Claims).Claims(c.Rest).Serialize()
		},
	}
	cache := remotecache.NewFakeCacheStorage()
	s := ProvideService(
		setting.NewCfg(), signer, cache,
		&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
	)
	ident := &authn.Identity{ID: "1", Type: claims.TypeUser}

	t.Run("should sign on every call and not write to the cache", func(t *testing.T) {
		for range 2 {
			token, _, err := s.SignIdentity(context.Background(), ident)
			require.NoError(t, err)
			require.NotEmpty(t, token)
		}
		assert.EqualValues(t, 2, calls.Load())
		assert.Empty(t, cache.Storage)
	})

	t.Run("should not share a token between overlapping calls", func(t *testing.T) {
		calls.Store(0)
		release := make(chan struct{})
		entered := make(chan struct{}, 2)
		blocking := &idtest.FakeSigner{
			SignIDTokenFn: func(ctx context.Context, c *auth.IDClaims) (string, error) {
				entered <- struct{}{}
				<-release
				return signer.SignIDToken(ctx, c)
			},
		}
		bs := ProvideService(
			setting.NewCfg(), blocking, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)

		var wg sync.WaitGroup
		for range 2 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, _, err := bs.SignIdentity(context.Background(), ident)
				assert.NoError(t, err)
			}()
		}
		// Both calls must reach the signer before either is released.
		<-entered
		<-entered
		close(release)
		wg.Wait()
		assert.EqualValues(t, 2, calls.Load())
	})

	t.Run("should not read tokens from the cache", func(t *testing.T) {
		cache.Storage[s.getCacheKey(ident)] = []byte("not-a-jwt")

		token, _, err := s.SignIdentity(context.Background(), ident)
		require.NoError(t, err)
		assert.NotEqual(t, "not-a-jwt", token)
	})

	t.Run("should not touch the cache when removing a token", func(t *testing.T) {
		require.NoError(t, s.RemoveIDToken(context.Background(), ident))
		assert.Contains(t, cache.Storage, s.getCacheKey(ident))
	})
}

func TestService_SyncIDToken(t *testing.T) {
	t.Run("should not fail authentication when signing fails", func(t *testing.T) {
		failing := &idtest.FakeSigner{
			SignIDTokenFn: func(_ context.Context, _ *auth.IDClaims) (string, error) {
				return "", errors.New("boom")
			},
		}
		s := ProvideService(
			setting.NewCfg(), failing, remotecache.NewFakeCacheStorage(),
			&authntest.FakeService{}, nil, tracing.InitializeTracerForTest(),
		)
		ident := &authn.Identity{ID: "1", Type: claims.TypeUser}

		require.NoError(t, s.SyncIDToken(context.Background(), ident, &authn.Request{}))
		assert.Empty(t, ident.IDToken)
		assert.Nil(t, ident.IDTokenClaims)
	})
}
