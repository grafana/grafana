package rendering

import (
	"bytes"
	"encoding/base64"
	"encoding/gob"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRenderingService_GetRenderUserFromJWT(t *testing.T) {
	const authToken = "render-secret"

	j := &jwtRenderKeyProvider{
		authToken:  []byte(authToken),
		log:        log.NewNopLogger(),
		namespacer: request.GetNamespaceMapper(nil),
	}

	assertNotAuthenticated := func(t *testing.T, key string) {
		t.Helper()
		for _, orgID := range []int64{0, 1} {
			user, found := j.validate(t.Context(), key, orgID)
			require.False(t, found)
			require.Nil(t, user)
		}
	}

	t.Run("returns render user from valid token", func(t *testing.T) {
		key := mustSignRenderJWT(t, authToken, renderJWT{
			RenderUser: &RenderUser{
				OrgID:     1,
				UserID:    2,
				OrgRole:   "Viewer",
				Namespace: "default",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		renderUser, found := j.validate(t.Context(), key, 1)
		require.True(t, found)
		require.NotNil(t, renderUser)
		require.Equal(t, &RenderUser{OrgID: 1, UserID: 2, OrgRole: "Viewer", Namespace: "default"}, renderUser)

		renderUser, found = j.validate(t.Context(), key, 0)
		require.True(t, found)
		require.Equal(t, &RenderUser{OrgID: 1, UserID: 2, OrgRole: "Viewer", Namespace: "default"}, renderUser)
	})

	t.Run("returns nil when render user is null", func(t *testing.T) {
		key := mustSignRenderJWT(t, authToken, renderJWT{
			RenderUser: nil,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		assertNotAuthenticated(t, key)
	})

	t.Run("returns nil for jwt signed with unexpected algorithm", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, renderJWT{
			RenderUser: &RenderUser{
				OrgID:     1,
				UserID:    9,
				OrgRole:   "Admin",
				Namespace: "default",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		key, err := token.SignedString([]byte(authToken))
		require.NoError(t, err)

		assertNotAuthenticated(t, key)
	})

	t.Run("returns nil for expired token", func(t *testing.T) {
		key := mustSignRenderJWT(t, authToken, renderJWT{
			RenderUser: &RenderUser{
				OrgID:     1,
				UserID:    2,
				OrgRole:   "Viewer",
				Namespace: "default",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(-time.Hour)),
			},
		})

		assertNotAuthenticated(t, key)
	})

	t.Run("returns nil for token signed with wrong key", func(t *testing.T) {
		key := mustSignRenderJWT(t, "wrong-secret", renderJWT{
			RenderUser: &RenderUser{
				OrgID:     1,
				UserID:    2,
				OrgRole:   "Admin",
				Namespace: "default",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		assertNotAuthenticated(t, key)
	})

	t.Run("returns nil for invalid JWTs", func(t *testing.T) {
		assertNotAuthenticated(t, "")

		assertNotAuthenticated(t, "not.a.jwt")

		key, err := jwt.SigningMethodHS512.Sign("null", []byte(authToken))
		require.NoError(t, err)
		assertNotAuthenticated(t, key)

		key, err = jwt.SigningMethodHS512.Sign("", []byte(authToken))
		require.NoError(t, err)
		assertNotAuthenticated(t, key)

		// missing parts, raw
		key, err = jwt.SigningMethodHS512.Sign(base64.RawURLEncoding.EncodeToString([]byte(`{"exp":4102444800}`)), []byte(authToken))
		require.NoError(t, err)
		assertNotAuthenticated(t, key)

		key, err = jwt.SigningMethodHS512.Sign(base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS512","typ":"JWT"}`)), []byte(authToken))
		require.NoError(t, err)
		assertNotAuthenticated(t, key)
	})

	t.Run("returns nil for weak auth cases", func(t *testing.T) {
		claims := renderJWT{
			RenderUser: &RenderUser{
				OrgID:     1,
				UserID:    2,
				OrgRole:   "Admin",
				Namespace: "default",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		}

		t.Run("alg:none", func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
			key, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
			require.NoError(t, err)

			assertNotAuthenticated(t, key)
		})

		t.Run("blank secret", func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
			key, err := token.SignedString([]byte(""))
			require.NoError(t, err)

			assertNotAuthenticated(t, key)
		})

		t.Run("null signature", func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
			key, err := token.SignedString([]byte(authToken))
			require.NoError(t, err)

			// Strip the signature: keep "header.payload." with a trailing dot.
			parts := strings.SplitN(key, ".", 3)
			require.Len(t, parts, 3)

			nullSig := parts[0] + "." + parts[1] + "."
			assertNotAuthenticated(t, nullSig)
		})
	})
}

func TestRenderingService_RenderKeyNamespace(t *testing.T) {
	tests := []struct {
		name        string
		sourceStack string
		targetStack string
		renderOrg   int64
		requestOrg  int64
		wantFound   bool
		legacy      bool
		namespace   string
	}{
		{name: "same stack", sourceStack: "100", targetStack: "100", requestOrg: 123, wantFound: true},
		{name: "different stack with same user and org IDs", sourceStack: "100", targetStack: "200", requestOrg: 123},
		{name: "different stack without request org", sourceStack: "100", targetStack: "200"},
		{name: "same stack without request org", sourceStack: "100", targetStack: "100", wantFound: true},
		{name: "same stack with different request org", sourceStack: "100", targetStack: "100", requestOrg: 124, wantFound: true},
		{name: "same on-prem org", requestOrg: 123, wantFound: true},
		{name: "different on-prem org", requestOrg: 124},
		{name: "on-prem without request org", wantFound: true},
		{name: "default on-prem org without request org", renderOrg: 1, wantFound: true},
		{name: "mismatched on-prem namespace without request org", namespace: "default"},
		{name: "cloud token on-prem", sourceStack: "100", requestOrg: 123},
		{name: "on-prem token in cloud", targetStack: "100", requestOrg: 123},
		{name: "legacy key without namespace", sourceStack: "100", targetStack: "100", requestOrg: 123, legacy: true},
		{name: "legacy cloud key without namespace or request org", sourceStack: "100", targetStack: "100", legacy: true},
		{name: "legacy on-prem key without namespace or request org", legacy: true},
	}

	for _, useJWT := range []bool{true, false} {
		name := "cache"
		features := featuremgmt.WithFeatures()
		if useJWT {
			name = "JWT"
			features = featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT)
		}
		t.Run(name, func(t *testing.T) {
			var cache *remotecache.RemoteCache
			if !useJWT {
				var err error
				cache, err = remotecache.ProvideService(&setting.Cfg{
					RemoteCacheOptions: &setting.RemoteCacheSettings{Name: "database"},
				}, db.NewTestStore(t), &usagestats.UsageStatsMock{}, nil)
				require.NoError(t, err)
			}
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					newService := func(stackID string) *RenderingService {
						cfg := setting.NewCfg()
						cfg.StackID = stackID
						cfg.AppURL = "http://grafana.example/"
						cfg.RendererServerUrl = "http://renderer.example/render"
						cfg.RendererAuthToken = "shared-renderer-secret"
						cfg.RendererRenderKeyLifeTime = time.Hour
						cfg.ImagesDir = filepath.Join(t.TempDir(), "images")
						cfg.CSVsDir = filepath.Join(t.TempDir(), "csvs")
						cfg.PDFsDir = filepath.Join(t.TempDir(), "pdfs")
						rs, err := ProvideService(cfg, features, cache)
						require.NoError(t, err)
						return rs
					}
					source := newService(tt.sourceStack)
					target := newService(tt.targetStack)
					renderOrg := tt.renderOrg
					if renderOrg == 0 {
						renderOrg = 123
					}
					key, err := source.perRequestRenderKeyProvider.get(t.Context(), AuthOpts{OrgID: renderOrg, UserID: 22, OrgRole: org.RoleViewer})
					require.NoError(t, err)
					if tt.legacy || tt.namespace != "" {
						user := &RenderUser{OrgID: renderOrg, UserID: 22, OrgRole: "Viewer", Namespace: tt.namespace}
						if useJWT {
							key = mustSignRenderJWT(t, source.Cfg.RendererAuthToken, renderJWT{
								RenderUser:       user,
								RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
							})
						} else {
							var buf bytes.Buffer
							require.NoError(t, gob.NewEncoder(&buf).Encode(user))
							require.NoError(t, cache.Set(t.Context(), fmt.Sprintf(renderKeyPrefix, key), buf.Bytes(), time.Hour))
						}
					}

					user, found := target.GetRenderUser(t.Context(), key, tt.requestOrg)
					require.Equal(t, tt.wantFound, found)
					if !tt.wantFound {
						require.Nil(t, user)
						return
					}
					namespace := "org-123"
					if renderOrg == 1 {
						namespace = "default"
					}
					if tt.sourceStack != "" {
						namespace = "stacks-" + tt.sourceStack
					}
					require.Equal(t, &RenderUser{
						OrgID: renderOrg, UserID: 22, OrgRole: "Viewer",
						Namespace: namespace,
					}, user)
				})
			}
		})
	}
}

func mustSignRenderJWT(t *testing.T, authToken string, claims renderJWT) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
	key, err := token.SignedString([]byte(authToken))
	require.NoError(t, err)

	return key
}
