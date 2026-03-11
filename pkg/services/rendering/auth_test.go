package rendering

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRenderingService_GetRenderUserFromJWT(t *testing.T) {
	const authToken = "render-secret"

	rs := &RenderingService{
		Cfg: &setting.Cfg{
			RendererAuthToken: authToken,
		},
		log: log.NewNopLogger(),
	}

	t.Run("returns render user from valid token", func(t *testing.T) {
		key := mustSignRenderJWT(t, authToken, renderJWT{
			RenderUser: &RenderUser{
				OrgID:   1,
				UserID:  2,
				OrgRole: "Viewer",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		renderUser := rs.getRenderUserFromJWT(key)
		require.NotNil(t, renderUser)
		require.Equal(t, &RenderUser{OrgID: 1, UserID: 2, OrgRole: "Viewer"}, renderUser)
	})

	t.Run("returns nil when render user is null", func(t *testing.T) {
		key := mustSignRenderJWT(t, authToken, renderJWT{
			RenderUser: nil,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		renderUser := rs.getRenderUserFromJWT(key)
		require.Nil(t, renderUser)
	})

	t.Run("returns nil for jwt signed with unexpected algorithm", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, renderJWT{
			RenderUser: &RenderUser{
				OrgID:   7,
				UserID:  9,
				OrgRole: "Admin",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		key, err := token.SignedString([]byte(authToken))
		require.NoError(t, err)

		require.Nil(t, rs.getRenderUserFromJWT(key))
	})

	t.Run("returns nil for expired token", func(t *testing.T) {
		key := mustSignRenderJWT(t, authToken, renderJWT{
			RenderUser: &RenderUser{
				OrgID:   1,
				UserID:  2,
				OrgRole: "Viewer",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(-time.Hour)),
			},
		})

		require.Nil(t, rs.getRenderUserFromJWT(key))
	})

	t.Run("returns nil for token signed with wrong key", func(t *testing.T) {
		key := mustSignRenderJWT(t, "wrong-secret", renderJWT{
			RenderUser: &RenderUser{
				OrgID:   1,
				UserID:  2,
				OrgRole: "Admin",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})

		require.Nil(t, rs.getRenderUserFromJWT(key))
	})

	t.Run("returns nil for invalid JWTs", func(t *testing.T) {
		require.Nil(t, rs.getRenderUserFromJWT(""))

		require.Nil(t, rs.getRenderUserFromJWT("not.a.jwt"))

		key, err := jwt.SigningMethodHS512.Sign("null", []byte(authToken))
		require.NoError(t, err)
		require.Nil(t, rs.getRenderUserFromJWT(key))

		key, err = jwt.SigningMethodHS512.Sign("", []byte(authToken))
		require.NoError(t, err)
		require.Nil(t, rs.getRenderUserFromJWT(key))

		// missing parts, raw
		key, err = jwt.SigningMethodHS512.Sign(base64.RawURLEncoding.EncodeToString([]byte(`{"exp":4102444800}`)), []byte(authToken))
		require.NoError(t, err)
		require.Nil(t, rs.getRenderUserFromJWT(key))

		key, err = jwt.SigningMethodHS512.Sign(base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS512","typ":"JWT"}`)), []byte(authToken))
		require.NoError(t, err)
		require.Nil(t, rs.getRenderUserFromJWT(key))
	})

	t.Run("returns nil for weak auth cases", func(t *testing.T) {
		claims := renderJWT{
			RenderUser: &RenderUser{
				OrgID:   1,
				UserID:  2,
				OrgRole: "Admin",
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		}

		t.Run("alg:none", func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
			key, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
			require.NoError(t, err)

			require.Nil(t, rs.getRenderUserFromJWT(key))
		})

		t.Run("blank secret", func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
			key, err := token.SignedString([]byte(""))
			require.NoError(t, err)

			require.Nil(t, rs.getRenderUserFromJWT(key))
		})

		t.Run("null signature", func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
			key, err := token.SignedString([]byte(authToken))
			require.NoError(t, err)

			// Strip the signature: keep "header.payload." with a trailing dot.
			parts := strings.SplitN(key, ".", 3)
			require.Len(t, parts, 3)

			nullSig := parts[0] + "." + parts[1] + "."
			require.Nil(t, rs.getRenderUserFromJWT(nullSig))
		})
	})
}

func mustSignRenderJWT(t *testing.T, authToken string, claims renderJWT) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
	key, err := token.SignedString([]byte(authToken))
	require.NoError(t, err)

	return key
}
