package pluginrouter

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"mime"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// sessionCookie carries the token minted at login. Named for this target so
	// it cannot be confused with a Grafana session on the same host.
	sessionCookie = "grafana_plugin_router_session"

	// sessionTTL is how long a login lasts. Long enough to browse the API for a
	// working day, short enough that a forgotten tab does not stay live.
	sessionTTL = 12 * time.Hour
)

// passwordLogin is the part of authn.Service this gate uses: Grafana's own
// form login, against Grafana's own users.
type passwordLogin interface {
	Login(ctx context.Context, client string, r *authn.Request) (*authn.Identity, error)
}

// session is a signed-in caller: who they are, and until when.
type session struct {
	requester identity.Requester
	expires   time.Time
}

// loginGate is Grafana's own sign-in, in front of the groups this target
// serves.
//
// Authentication is the real thing: the form is handed to authn.Service's form
// client, the same one Grafana's own login page posts to, so callers are real
// Grafana users with real passwords, and everything that hangs off that --
// hashing, login attempt limiting, whatever else is configured -- applies here
// too. A caller that passes gets a session cookie.
//
// Authorization is not. A signed-in caller runs as Grafana's service identity,
// with full access to every group served, because the groups' own authorizer
// asks about permissions this target's callers are unlikely to hold. Proving
// who you are and being granted everything is a development posture, which is
// why the target only runs in a development environment. Serving each caller
// their own permissions is the next step, not this one.
type loginGate struct {
	authn  passwordLogin
	secure bool
	log    log.Logger

	mu       sync.Mutex
	sessions map[string]session
}

func newLoginGate(cfg *setting.Cfg, authn passwordLogin, logger log.Logger) (*loginGate, error) {
	if authn == nil {
		return nil, fmt.Errorf("the plugin router signs callers in through Grafana's authentication, and it is not wired")
	}
	return &loginGate{
		authn:    authn,
		secure:   cfg.Protocol == setting.HTTPSScheme || cfg.Protocol == setting.HTTP2Scheme,
		log:      logger,
		sessions: map[string]session{},
	}, nil
}

func (g *loginGate) register(httpRouter *mux.Router) {
	httpRouter.Path("/login").Methods(http.MethodGet).HandlerFunc(g.form)
	httpRouter.Path("/login").Methods(http.MethodPost).HandlerFunc(g.submit)
	httpRouter.Path("/logout").HandlerFunc(g.logout)
}

// middleware puts the service identity on requests that carry a live session,
// and leaves every other request exactly as it found it -- unauthenticated, so
// the group behind it answers 401 rather than serving anonymously.
func (g *loginGate) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if g.authenticated(req) == nil {
			next.ServeHTTP(w, req)
			return
		}
		ctx, _ := identity.WithServiceIdentity(req.Context(), 1)
		next.ServeHTTP(w, req.WithContext(ctx))
	})
}

// authenticated returns the caller a request carries a live session for, or
// nil. The caller is kept even though authorization does not use it yet -- it
// is who signed in, which is worth saying in a log line, and is what serving
// real permissions would read.
func (g *loginGate) authenticated(req *http.Request) identity.Requester {
	cookie, err := req.Cookie(sessionCookie)
	if err != nil || cookie.Value == "" {
		return nil
	}

	g.mu.Lock()
	defer g.mu.Unlock()
	live, ok := g.sessions[cookie.Value]
	if !ok {
		return nil
	}
	if time.Now().After(live.expires) {
		delete(g.sessions, cookie.Value)
		return nil
	}
	return live.requester
}

func (g *loginGate) form(w http.ResponseWriter, _ *http.Request) {
	g.renderForm(w, http.StatusOK, "")
}

func (g *loginGate) submit(w http.ResponseWriter, req *http.Request) {
	// The form client reads the credentials off the request itself, so it is
	// handed the request rather than fields parsed out of it -- which is also
	// why the form posts "user", the field name that client binds.
	loginReq, err := asJSONLogin(req)
	if err != nil {
		g.renderForm(w, http.StatusBadRequest, "That form could not be read.")
		return
	}

	requester, err := g.authn.Login(req.Context(), authn.ClientForm, &authn.Request{HTTPRequest: loginReq})
	if err != nil {
		// Whatever went wrong -- unknown user, wrong password, too many
		// attempts -- the form says the same thing, so it cannot be used to
		// find out which usernames exist. The reason is logged, not shown.
		g.log.Warn("failed login attempt", "remote", req.RemoteAddr, "error", err)
		g.renderForm(w, http.StatusUnauthorized, "Wrong username or password.")
		return
	}

	token, err := g.newSession(requester)
	if err != nil {
		g.log.Error("could not start a session", "error", err)
		g.renderForm(w, http.StatusInternalServerError, "Could not start a session.")
		return
	}

	// HttpOnly and SameSite are set below. Secure follows the protocol the
	// server is actually serving: this target listens on plain HTTP by default,
	// and a Secure cookie would never be sent back over it, so no one could
	// sign in. An HTTPS deployment sets it, through the same field.
	http.SetCookie(w, &http.Cookie{ // #nosec G124 nosemgrep: go.lang.security.audit.net.cookie-missing-secure.cookie-missing-secure
		Name:  sessionCookie,
		Value: token,
		Path:  "/",
		// The token is only ever read back by this server, so it is kept out of
		// scripts, and out of requests another site makes.
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   g.secure,
		Expires:  time.Now().Add(sessionTTL),
	})
	g.log.Info("signed in", "user", requester.GetLogin(), "uid", requester.GetUID())
	http.Redirect(w, req, "/swagger", http.StatusFound)
}

func (g *loginGate) logout(w http.ResponseWriter, req *http.Request) {
	if cookie, err := req.Cookie(sessionCookie); err == nil {
		g.mu.Lock()
		delete(g.sessions, cookie.Value)
		g.mu.Unlock()
	}
	// As above -- and this one carries no token at all: a negative MaxAge is
	// what clears the session cookie.
	http.SetCookie(w, &http.Cookie{ // #nosec G124 nosemgrep: go.lang.security.audit.net.cookie-missing-secure.cookie-missing-secure
		Name: sessionCookie, Value: "", Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: g.secure, MaxAge: -1,
	})
	http.Redirect(w, req, "/login", http.StatusFound)
}

// asJSONLogin gives the form client the request shape it reads.
//
// It binds JSON and nothing else (web.Bind), and Grafana's own login page posts
// JSON from script. This page is plain HTML, so a browser posts it
// form-encoded, and the translation happens here rather than by putting script
// on a page that otherwise needs none. A caller that already posts JSON -- curl,
// mostly -- is passed through untouched.
func asJSONLogin(req *http.Request) (*http.Request, error) {
	if mediaType, _, err := mime.ParseMediaType(req.Header.Get("Content-Type")); err == nil && mediaType == "application/json" {
		return req, nil
	}

	if err := req.ParseForm(); err != nil {
		return nil, err
	}
	body, err := json.Marshal(map[string]string{
		"user":     req.PostFormValue("user"),
		"password": req.PostFormValue("password"),
	})
	if err != nil {
		return nil, err
	}

	out := req.Clone(req.Context())
	out.Header = req.Header.Clone()
	out.Header.Set("Content-Type", "application/json")
	out.Body = io.NopCloser(bytes.NewReader(body))
	out.ContentLength = int64(len(body))
	return out, nil
}

// newSession mints a token for a caller and drops any that have expired, so a
// long-running process does not accumulate them.
func (g *loginGate) newSession(requester identity.Requester) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	g.mu.Lock()
	defer g.mu.Unlock()
	now := time.Now()
	for existing, live := range g.sessions {
		if now.After(live.expires) {
			delete(g.sessions, existing)
		}
	}
	g.sessions[token] = session{requester: requester, expires: now.Add(sessionTTL)}
	return token, nil
}

func (g *loginGate) renderForm(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	if err := loginPage.Execute(w, map[string]string{"Message": message}); err != nil {
		g.log.Error("failed to render the login page", "error", err)
	}
}

// loginPage is deliberately self-contained: this target serves the API
// navigator's bundle, but a login form that needed a frontend build to render
// would be one more thing to get wrong before anyone can sign in.
var loginPage = template.Must(template.New("login").Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in</title>
<style>
  body { font-family: system-ui, sans-serif; background: #111217; color: #ccccdc;
         display: flex; min-height: 100vh; margin: 0; align-items: center; justify-content: center; }
  form { background: #181b1f; border: 1px solid #2c3235; border-radius: 4px; padding: 32px; width: 320px; }
  h1 { font-size: 1.1rem; font-weight: 500; margin: 0 0 4px; }
  p.sub { color: #8e8e8e; font-size: 0.8rem; margin: 0 0 24px; }
  label { display: block; font-size: 0.8rem; margin-bottom: 4px; }
  input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 16px;
          background: #0b0c0e; color: #ccccdc; border: 1px solid #2c3235; border-radius: 2px; }
  button { width: 100%; padding: 8px; background: #3d71d9; color: #fff;
           border: 0; border-radius: 2px; font-size: 0.9rem; cursor: pointer; }
  .error { background: #4d1a1a; border: 1px solid #a52a2a; border-radius: 2px;
           padding: 8px; margin-bottom: 16px; font-size: 0.8rem; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>Grafana plugin router</h1>
  <p class="sub">Sign in to browse the app plugin APIs.</p>
  {{if .Message}}<div class="error">{{.Message}}</div>{{end}}
  <label for="user">Username</label>
  <input id="user" name="user" autocomplete="username" autofocus>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password">
  <button type="submit">Sign in</button>
</form>
</body>
</html>
`))
