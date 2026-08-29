package pluginrouter

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"html/template"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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

// loginGate is username and password in front of the service identity.
//
// What it is: the credentials from the security section -- the same admin_user
// and admin_password a fresh Grafana starts with -- checked against a form, and
// a session cookie for the callers that pass. A request carrying a live session
// runs as Grafana's service identity, which is what the groups served here
// authorize against.
//
// What it is not: Grafana's authentication. There is no user database in this
// process to look anyone up in, so there is one credential, it is the same for
// everyone, and everyone who has it gets the same full access. There is no
// lockout, no rate limit and no second factor. It exists so this target can be
// exercised without granting the port to anyone who reaches it, which is why
// the target it belongs to only runs in a development environment.
type loginGate struct {
	user     string
	password string
	secure   bool
	log      log.Logger

	mu       sync.Mutex
	sessions map[string]time.Time
}

func newLoginGate(cfg *setting.Cfg, logger log.Logger) (*loginGate, error) {
	if cfg.AdminUser == "" || cfg.AdminPassword == "" {
		return nil, fmt.Errorf("the plugin router signs callers in against security.admin_user and security.admin_password, and both must be set")
	}
	return &loginGate{
		user:     cfg.AdminUser,
		password: cfg.AdminPassword,
		secure:   cfg.Protocol == setting.HTTPSScheme || cfg.Protocol == setting.HTTP2Scheme,
		log:      logger,
		sessions: map[string]time.Time{},
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
		if !g.authenticated(req) {
			next.ServeHTTP(w, req)
			return
		}
		ctx, _ := identity.WithServiceIdentity(req.Context(), 1)
		next.ServeHTTP(w, req.WithContext(ctx))
	})
}

func (g *loginGate) authenticated(req *http.Request) bool {
	cookie, err := req.Cookie(sessionCookie)
	if err != nil || cookie.Value == "" {
		return false
	}

	g.mu.Lock()
	defer g.mu.Unlock()
	expires, ok := g.sessions[cookie.Value]
	if !ok {
		return false
	}
	if time.Now().After(expires) {
		delete(g.sessions, cookie.Value)
		return false
	}
	return true
}

func (g *loginGate) form(w http.ResponseWriter, _ *http.Request) {
	g.renderForm(w, http.StatusOK, "")
}

func (g *loginGate) submit(w http.ResponseWriter, req *http.Request) {
	if err := req.ParseForm(); err != nil {
		g.renderForm(w, http.StatusBadRequest, "That form could not be read.")
		return
	}

	// Both halves are compared in constant time, and both are compared even
	// when the first has already failed, so neither the username nor the
	// password can be recovered from how long the answer took.
	userOK := subtle.ConstantTimeCompare([]byte(req.PostFormValue("username")), []byte(g.user)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(req.PostFormValue("password")), []byte(g.password)) == 1
	if !userOK || !passOK {
		g.log.Warn("failed login attempt", "remote", req.RemoteAddr)
		g.renderForm(w, http.StatusUnauthorized, "Wrong username or password.")
		return
	}

	token, err := g.newSession()
	if err != nil {
		g.log.Error("could not start a session", "error", err)
		g.renderForm(w, http.StatusInternalServerError, "Could not start a session.")
		return
	}

	// #nosec G124 -- HttpOnly and SameSite are set below; Secure follows the
	// protocol the server is actually serving, because this target listens on
	// plain HTTP by default and a Secure cookie would never come back over it.
	http.SetCookie(w, &http.Cookie{
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
	http.Redirect(w, req, "/swagger", http.StatusFound)
}

func (g *loginGate) logout(w http.ResponseWriter, req *http.Request) {
	if cookie, err := req.Cookie(sessionCookie); err == nil {
		g.mu.Lock()
		delete(g.sessions, cookie.Value)
		g.mu.Unlock()
	}
	// #nosec G124 -- as above, and this one carries no value at all: it is the
	// expiry that clears the session cookie.
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: g.secure, MaxAge: -1,
	})
	http.Redirect(w, req, "/login", http.StatusFound)
}

// newSession mints a token and drops any that have expired, so a long-running
// process does not accumulate them.
func (g *loginGate) newSession() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	g.mu.Lock()
	defer g.mu.Unlock()
	now := time.Now()
	for existing, expires := range g.sessions {
		if now.After(expires) {
			delete(g.sessions, existing)
		}
	}
	g.sessions[token] = now.Add(sessionTTL)
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
  <label for="username">Username</label>
  <input id="username" name="username" autocomplete="username" autofocus>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password">
  <button type="submit">Sign in</button>
</form>
</body>
</html>
`))
