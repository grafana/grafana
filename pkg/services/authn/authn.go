package authn

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const (
	ClientAPIKey      = "auth.client.api-key" // #nosec G101
	ClientAnonymous   = "auth.client.anonymous"
	ClientBasic       = "auth.client.basic"
	ClientJWT         = "auth.client.jwt"
	ClientExtendedJWT = "auth.client.extended-jwt"
	ClientRender      = "auth.client.render"
	ClientSession     = "auth.client.session"
	ClientForm        = "auth.client.form"
	ClientProxy       = "auth.client.proxy"
	ClientSAML        = "auth.client.saml"
)

const (
	MetaKeyUsername   = "username"
	MetaKeyAuthModule = "authModule"
	MetaKeyIsLogin    = "isLogin"
)

// ClientParams are hints to the auth service about how to handle the identity management
// from the authenticating client.
type ClientParams struct {
	// SyncUser updates the internal representation of the identity from the identity provided
	SyncUser bool
	// AllowSignUp Adds identity to DB if it doesn't exist when, only work if SyncUser is enabled
	AllowSignUp bool
	// EnableUser will ensure the user is enabled, only work if SyncUser is enabled
	EnableUser bool
	// FetchSyncedUser ensure that all required information is added to the identity
	FetchSyncedUser bool
	// SyncTeams will sync the groups from identity to teams in grafana, enterprise only feature
	SyncTeams bool
	// SyncOrgRoles will sync the roles from the identity to orgs in grafana
	SyncOrgRoles bool
	// CacheAuthProxyKey  if this key is set we will try to cache the user id for proxy client
	CacheAuthProxyKey string
	// LookUpParams are the arguments used to look up the entity in the DB.
	LookUpParams login.UserLookupParams
	// SyncPermissions ensure that permissions are loaded from DB and added to the identity
	SyncPermissions bool
}

type PostAuthHookFn func(ctx context.Context, identity *Identity, r *Request) error
type PostLoginHookFn func(ctx context.Context, identity *Identity, r *Request, err error)

type Service interface {
	// Authenticate authenticates a request
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
	// RegisterPostAuthHook registers a hook with a priority that is called after a successful authentication.
	// A lower number means higher priority.
	RegisterPostAuthHook(hook PostAuthHookFn, priority uint)
	// Login authenticates a request and creates a session on successful authentication.
	Login(ctx context.Context, client string, r *Request) (*Identity, error)
	// RegisterPostLoginHook registers a hook that that is called after a login request.
	// A lower number means higher priority.
	RegisterPostLoginHook(hook PostLoginHookFn, priority uint)
	// RedirectURL will generate url that we can use to initiate auth flow for supported clients.
	RedirectURL(ctx context.Context, client string, r *Request) (*Redirect, error)
	// RegisterClient will register a new authn.Client that can be used for authentication
	RegisterClient(c Client)
}

type IdentitySynchronizer interface {
	SyncIdentity(ctx context.Context, identity *Identity) error
}

type Client interface {
	// Name returns the name of a client
	Name() string
	// Authenticate performs the authentication for the request
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
}

// ContextAwareClient is an optional interface that auth client can implement.
// Clients that implements this interface will be tried during request authentication
type ContextAwareClient interface {
	Client
	// Test should return true if client can be used to authenticate request
	Test(ctx context.Context, r *Request) bool
	// Priority for the client, a lower number means higher priority
	Priority() uint
}

// HookClient is an optional interface that auth clients can implement.
// Clients that implements this interface can specify an auth hook that will
// be called only for that client.
type HookClient interface {
	Client
	Hook(ctx context.Context, identity *Identity, r *Request) error
}

// RedirectClient is an optional interface that auth clients can implement.
// Clients that implements this interface can be used to generate redirect urls
// for authentication flows, e.g. oauth clients
type RedirectClient interface {
	Client
	RedirectURL(ctx context.Context, r *Request) (*Redirect, error)
}

type PasswordClient interface {
	AuthenticatePassword(ctx context.Context, r *Request, username, password string) (*Identity, error)
}

type ProxyClient interface {
	AuthenticateProxy(ctx context.Context, r *Request, username string, additional map[string]string) (*Identity, error)
}

// UsageStatClient is an optional interface that auth clients can implement.
// Clients that implements this interface can specify a usage stat collection hook
type UsageStatClient interface {
	Client
	UsageStatFn(ctx context.Context) (map[string]any, error)
}

type Request struct {
	// OrgID will be populated by authn.Service
	OrgID int64
	// HTTPRequest is the original HTTP request to authenticate
	HTTPRequest *http.Request

	// Resp is the response writer to use for the request
	// Used to set cookies and headers
	Resp web.ResponseWriter

	// metadata is additional information about the auth request
	metadata map[string]string
}

func (r *Request) SetMeta(k, v string) {
	if r.metadata == nil {
		r.metadata = map[string]string{}
	}
	r.metadata[k] = v
}

func (r *Request) GetMeta(k string) string {
	if r.metadata == nil {
		r.metadata = map[string]string{}
	}
	return r.metadata[k]
}

const (
	KeyOAuthPKCE  = "pkce"
	KeyOAuthState = "state"
)

type Redirect struct {
	// Url used for redirect
	URL string
	// Extra contains data used for redirect, e.g. for oauth this would be state and pkce
	Extra map[string]string
}

// ClientWithPrefix returns a client name prefixed with "auth.client."
func ClientWithPrefix(name string) string {
	return fmt.Sprintf("auth.client.%s", name)
}

type RedirectValidator func(url string) error

// HandleLoginResponse is a utility function to perform common operations after a successful login and returns response.NormalResponse
func HandleLoginResponse(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator) *response.NormalResponse {
	result := map[string]any{"message": "Logged in"}
	result["redirectUrl"] = handleLogin(r, w, cfg, identity, validator)
	return response.JSON(http.StatusOK, result)
}

// HandleLoginRedirect is a utility function to perform common operations after a successful login and redirects
func HandleLoginRedirect(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator) {
	redirectURL := handleLogin(r, w, cfg, identity, validator)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// HandleLoginRedirectResponse is a utility function to perform common operations after a successful login and return a response.RedirectResponse
func HandleLoginRedirectResponse(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator) *response.RedirectResponse {
	return response.Redirect(handleLogin(r, w, cfg, identity, validator))
}

func handleLogin(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator) string {
	redirectURL := cfg.AppSubURL + "/"
	if redirectTo := getRedirectURL(r); len(redirectTo) > 0 {
		if validator(redirectTo) == nil {
			redirectURL = redirectTo
		}
		cookies.DeleteCookie(w, "redirect_to", cookieOptions(cfg))
	}

	WriteSessionCookie(w, cfg, identity.SessionToken)
	return redirectURL
}

func getRedirectURL(r *http.Request) string {
	cookie, err := r.Cookie("redirect_to")
	if err != nil {
		return ""
	}

	v, _ := url.QueryUnescape(cookie.Value)
	return v
}

const sessionExpiryCookie = "grafana_session_expiry"

func WriteSessionCookie(w http.ResponseWriter, cfg *setting.Cfg, token *usertoken.UserToken) {
	maxAge := int(cfg.LoginMaxLifetime.Seconds())
	if cfg.LoginMaxLifetime <= 0 {
		maxAge = -1
	}

	cookies.WriteCookie(w, cfg.LoginCookieName, url.QueryEscape(token.UnhashedToken), maxAge, nil)
	expiry := token.NextRotation(time.Duration(cfg.TokenRotationIntervalMinutes) * time.Minute)
	cookies.WriteCookie(w, sessionExpiryCookie, url.QueryEscape(strconv.FormatInt(expiry.Unix(), 10)), maxAge, func() cookies.CookieOptions {
		opts := cookieOptions(cfg)()
		opts.NotHttpOnly = true
		return opts
	})
}

func DeleteSessionCookie(w http.ResponseWriter, cfg *setting.Cfg) {
	cookies.DeleteCookie(w, cfg.LoginCookieName, cookieOptions(cfg))
	cookies.DeleteCookie(w, sessionExpiryCookie, func() cookies.CookieOptions {
		opts := cookieOptions(cfg)()
		opts.NotHttpOnly = true
		return opts
	})
}

func cookieOptions(cfg *setting.Cfg) func() cookies.CookieOptions {
	return func() cookies.CookieOptions {
		path := "/"
		if len(cfg.AppSubURL) > 0 {
			path = cfg.AppSubURL
		}
		return cookies.CookieOptions{
			Path:             path,
			Secure:           cfg.CookieSecure,
			SameSiteDisabled: cfg.CookieSameSiteDisabled,
			SameSiteMode:     cfg.CookieSameSiteMode,
		}
	}
}
