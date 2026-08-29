package pluginrouter

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLoginGate(t *testing.T) {
	gate := testGate(t)
	httpRouter := mux.NewRouter()
	gate.register(httpRouter)

	t.Run("the form is served", func(t *testing.T) {
		res := serve(httpRouter, "/login")
		require.Equal(t, http.StatusOK, res.Code)
		require.Contains(t, res.Body.String(), `name="password"`)
	})

	t.Run("wrong credentials mint no session", func(t *testing.T) {
		res := postLogin(httpRouter, "admin", "wrong")
		require.Equal(t, http.StatusUnauthorized, res.Code)
		require.Contains(t, res.Body.String(), "Wrong username or password")
		require.Empty(t, res.Result().Cookies())
		require.Empty(t, gate.sessions)
	})

	t.Run("the right ones do", func(t *testing.T) {
		res := postLogin(httpRouter, "admin", "s3cret")
		require.Equal(t, http.StatusFound, res.Code)
		require.Equal(t, "/swagger", res.Header().Get("Location"))

		cookie := sessionFrom(t, res)
		require.NotEmpty(t, cookie.Value)
		require.True(t, cookie.HttpOnly, "the token must be kept out of scripts")
		require.Equal(t, http.SameSiteLaxMode, cookie.SameSite, "and out of another site's requests")
	})

	t.Run("logging out ends the session", func(t *testing.T) {
		res := postLogin(httpRouter, "admin", "s3cret")
		cookie := sessionFrom(t, res)

		req := httptest.NewRequest(http.MethodGet, "/logout", nil)
		req.AddCookie(cookie)
		out := httptest.NewRecorder()
		httpRouter.ServeHTTP(out, req)

		require.Equal(t, http.StatusFound, out.Code)
		require.Equal(t, "/login", out.Header().Get("Location"))
		require.False(t, gate.authenticated(withCookie(cookie)), "the token must not still work")
	})
}

// The identity is what the groups authorize against, so it must reach a request
// only when that request carried a live session.
func TestLoginGateMiddleware(t *testing.T) {
	gate := testGate(t)

	var got error
	handler := gate.middleware(http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		_, got = identity.GetRequester(req.Context())
	}))

	t.Run("no session, no identity", func(t *testing.T) {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/apis", nil))
		require.Error(t, got, "an unauthenticated request must stay unauthenticated")
	})

	t.Run("a session carries the service identity", func(t *testing.T) {
		token, err := gate.newSession()
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/apis", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.NoError(t, got)
	})

	t.Run("a token nothing minted is not a session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/apis", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "made-up"})
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.Error(t, got)
	})
}

// A session that outlives its window is not one, and is dropped rather than
// left to accumulate.
func TestLoginGateSessionExpiry(t *testing.T) {
	gate := testGate(t)

	token, err := gate.newSession()
	require.NoError(t, err)
	gate.sessions[token] = time.Now().Add(-time.Minute)

	require.False(t, gate.authenticated(withCookie(&http.Cookie{Name: sessionCookie, Value: token})))
	require.NotContains(t, gate.sessions, token)
}

// Without credentials to check against there is nothing to sign in with, and a
// form that accepted anything would be worse than no form.
func TestNewLoginGateNeedsCredentials(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.AdminUser = "admin"

	_, err := newLoginGate(cfg, log.New("test"))
	require.ErrorContains(t, err, "admin_password")
}

func testGate(t *testing.T) *loginGate {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.AdminUser = "admin"
	cfg.AdminPassword = "s3cret"

	gate, err := newLoginGate(cfg, log.New("test"))
	require.NoError(t, err)
	return gate
}

func postLogin(handler http.Handler, user, password string) *httptest.ResponseRecorder {
	form := url.Values{"username": {user}, "password": {password}}
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}

func sessionFrom(t *testing.T, res *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()

	for _, cookie := range res.Result().Cookies() {
		if cookie.Name == sessionCookie {
			return cookie
		}
	}
	t.Fatalf("no %s cookie was set", sessionCookie)
	return nil
}

func withCookie(cookie *http.Cookie) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(cookie)
	return req
}
