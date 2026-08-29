package pluginrouter

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

func testRequester() identity.Requester {
	return &authn.Identity{ID: "1", Type: claims.TypeUser, Login: "admin", OrgID: 1}
}

func TestLoginGate(t *testing.T) {
	gate := testGate(t)
	httpRouter := mux.NewRouter()
	gate.register(httpRouter)

	t.Run("the form is served", func(t *testing.T) {
		res := serve(httpRouter, "/login")
		require.Equal(t, http.StatusOK, res.Code)
		require.Contains(t, res.Body.String(), `name="password"`)
	})

	t.Run("the form posts the field Grafana's form client binds", func(t *testing.T) {
		res := serve(httpRouter, "/login")
		require.Contains(t, res.Body.String(), `name="user"`,
			"the form client reads \"user\", so a form posting anything else never authenticates")
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
		require.Nil(t, gate.authenticated(withCookie(cookie)), "the token must not still work")
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
		token, err := gate.newSession(testRequester())
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

	token, err := gate.newSession(testRequester())
	require.NoError(t, err)
	gate.sessions[token] = session{requester: testRequester(), expires: time.Now().Add(-time.Minute)}

	require.Nil(t, gate.authenticated(withCookie(&http.Cookie{Name: sessionCookie, Value: token})))
	require.NotContains(t, gate.sessions, token)
}

// Without Grafana's authentication there is nothing to sign in against, and a
// form that accepted anything would be worse than no form.
func TestNewLoginGateNeedsAuthentication(t *testing.T) {
	_, err := newLoginGate(setting.NewCfg(), nil, log.New("test"))
	require.ErrorContains(t, err, "not wired")
}

func testGate(t *testing.T) *loginGate {
	t.Helper()

	gate, err := newLoginGate(setting.NewCfg(), stubAuthn{}, log.New("test"))
	require.NoError(t, err)
	return gate
}

// stubAuthn stands in for Grafana's authentication: it accepts one caller, so
// these tests exercise the gate rather than the password check behind it.
type stubAuthn struct{}

func (stubAuthn) Login(_ context.Context, client string, r *authn.Request) (*authn.Identity, error) {
	if client != authn.ClientForm {
		return nil, fmt.Errorf("unexpected client %q", client)
	}
	if err := r.HTTPRequest.ParseForm(); err != nil {
		return nil, err
	}
	if r.HTTPRequest.PostFormValue("user") != "admin" || r.HTTPRequest.PostFormValue("password") != "s3cret" {
		return nil, errors.New("invalid username or password")
	}
	return &authn.Identity{ID: "1", Type: claims.TypeUser, Login: "admin", OrgID: 1}, nil
}

func postLogin(handler http.Handler, user, password string) *httptest.ResponseRecorder {
	form := url.Values{"user": {user}, "password": {password}}
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
