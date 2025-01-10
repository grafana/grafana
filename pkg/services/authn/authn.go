package authn

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	ClientAPIKey       = "auth.client.api-key" // #nosec G101
	ClientAnonymous    = "auth.client.anonymous"
	ClientBasic        = "auth.client.basic"
	ClientJWT          = "auth.client.jwt"
	ClientExtendedJWT  = "auth.client.extended-jwt"
	ClientRender       = "auth.client.render"
	ClientSession      = "auth.client.session"
	ClientForm         = "auth.client.form"
	ClientProxy        = "auth.client.proxy"
	ClientSAML         = "auth.client.saml"
	ClientPasswordless = "auth.client.passwordless"
	ClientLDAP         = "ldap"
)

const (
	MetaKeyUsername            = "username"
	MetaKeyAuthModule          = "authModule"
	MetaKeyIsLogin             = "isLogin"
	defaultRedirectToCookieKey = "redirect_to"
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
	// FetchPermissionsParams are the arguments used to fetch permissions from the DB
	FetchPermissionsParams FetchPermissionsParams
	// AllowGlobalOrg would allow a client to authenticate in global scope AKA org 0
	AllowGlobalOrg bool
}

type FetchPermissionsParams struct {
	// RestrictedActions will restrict the permissions to only these actions
	RestrictedActions []string
	// AllowedActions will be added to the identity permissions
	AllowedActions []string
	// Note: Kept for backwards compatibility, use AllowedActions instead
	// Roles permissions will be directly added to the identity permissions
	Roles []string
}

type (
	PostAuthHookFn  func(ctx context.Context, identity *Identity, r *Request) error
	PostLoginHookFn func(ctx context.Context, identity *Identity, r *Request, err error)
	PreLogoutHookFn func(ctx context.Context, requester identity.Requester, sessionToken *usertoken.UserToken) error
)

type Authenticator interface {
	// Authenticate authenticates a request
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
}

type SSOClientConfig interface {
	// GetDisplayName returns the display name of the client
	GetDisplayName() string
	// IsAutoLoginEnabled returns true if the client has auto login enabled
	IsAutoLoginEnabled() bool
	// IsSingleLogoutEnabled returns true if the client has single logout enabled
	IsSingleLogoutEnabled() bool
}

type Service interface {
	Authenticator
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
	// Logout revokes session token and does additional clean up if client used to authenticate supports it
	Logout(ctx context.Context, user identity.Requester, sessionToken *usertoken.UserToken) (*Redirect, error)
	// RegisterPreLogoutHook registers a hook that is called before a logout request.
	RegisterPreLogoutHook(hook PreLogoutHookFn, priority uint)
	// ResolveIdentity resolves an identity from orgID and typedID.
	ResolveIdentity(ctx context.Context, orgID int64, typedID string) (*Identity, error)

	// RegisterClient will register a new authn.Client that can be used for authentication
	RegisterClient(c Client)

	// IsClientEnabled returns true if the client is enabled.
	//
	// The client lookup follows the same formats used by the `authn` package
	// constants.
	//
	// For OAuth clients, use the `authn.ClientWithPrefix(name)` to get the provider
	// name. Append the prefix `auth.client.{providerName}`.
	//
	// Example:
	// - "saml" = "auth.client.saml"
	// - "github" = "auth.client.github"
	IsClientEnabled(client string) bool

	// GetClientConfig returns the client configuration for the given client and a boolean indicating if the config was present.
	GetClientConfig(client string) (SSOClientConfig, bool)
}

type IdentitySynchronizer interface {
	SyncIdentity(ctx context.Context, identity *Identity) error
}

type Client interface {
	Authenticator
	// Name returns the name of a client
	Name() string
	// IsEnabled returns the enabled status of the client
	IsEnabled() bool
}

// ContextAwareClient is an optional interface that auth client can implement.
// Clients that implements this interface will be tried during request authentication.
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
// for authentication flows, e.g. oauth clients.
type RedirectClient interface {
	Client
	RedirectURL(ctx context.Context, r *Request) (*Redirect, error)
}

// LogoutCLient is an optional interface that auth client can implement.
// Clients that implements this interface can implement additional logic
// that should happen during logout and supports client specific redirect URL.
type LogoutClient interface {
	Client
	Logout(ctx context.Context, user identity.Requester, sessionToken *usertoken.UserToken) (*Redirect, bool)
}

type SSOSettingsAwareClient interface {
	Client
	GetConfig() SSOClientConfig
}

type PasswordClient interface {
	AuthenticatePassword(ctx context.Context, r *Request, username, password string) (*Identity, error)
}

type ProxyClient interface {
	AuthenticateProxy(ctx context.Context, r *Request, username string, additional map[string]string) (*Identity, error)
}

// UsageStatClient is an optional interface that auth clients can implement.
// Clients that implements this interface can specify a usage stat collection hook.
type UsageStatClient interface {
	Client
	UsageStatFn(ctx context.Context) (map[string]any, error)
}

// IdentityResolverClient is an optional interface that auth clients can implement.
// Clients that implements this interface can resolve an full identity from an orgID and typedID.
type IdentityResolverClient interface {
	Client
	IdentityType() claims.IdentityType
	ResolveIdentity(ctx context.Context, orgID int64, typ claims.IdentityType, id string) (*Identity, error)
}

type Request struct {
	// OrgID will be populated by authn.Service
	OrgID int64
	// HTTPRequest is the original HTTP request to authenticate
	HTTPRequest *http.Request
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
func HandleLoginResponse(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator, features featuremgmt.FeatureToggles) *response.NormalResponse {
	result := map[string]any{"message": "Logged in"}
	result["redirectUrl"] = handleLogin(r, w, cfg, identity, validator, features, "")
	return response.JSON(http.StatusOK, result)
}

// HandleLoginRedirect is a utility function to perform common operations after a successful login and redirects
func HandleLoginRedirect(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator, features featuremgmt.FeatureToggles) {
	redirectURL := handleLogin(r, w, cfg, identity, validator, features, "redirectTo")
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// HandleLoginRedirectResponse is a utility function to perform common operations after a successful login and return a response.RedirectResponse
func HandleLoginRedirectResponse(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator, features featuremgmt.FeatureToggles, redirectToCookieName string) *response.RedirectResponse {
	return response.Redirect(handleLogin(r, w, cfg, identity, validator, features, redirectToCookieName))
}

func handleLogin(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator, features featuremgmt.FeatureToggles, redirectToCookieName string) string {
	WriteSessionCookie(w, cfg, identity.SessionToken)

	redirectURL := cfg.AppSubURL + "/"
	if features.IsEnabledGlobally(featuremgmt.FlagUseSessionStorageForRedirection) {
		if redirectToCookieName != "" {
			scopedRedirectToCookie, err := r.Cookie(redirectToCookieName)
			if err == nil {
				redirectTo, _ := url.QueryUnescape(scopedRedirectToCookie.Value)
				if redirectTo != "" && validator(redirectTo) == nil {
					redirectURL = cfg.AppSubURL + redirectTo
				}
				cookies.DeleteCookie(w, redirectToCookieName, cookieOptions(cfg))
			}
		}
		return redirectURL
	}

	redirectURL = cfg.AppSubURL + "/"
	if redirectTo := getRedirectURL(r); len(redirectTo) > 0 {
		if validator(redirectTo) == nil {
			redirectURL = redirectTo
		}
		cookies.DeleteCookie(w, defaultRedirectToCookieKey, cookieOptions(cfg))
	}

	return redirectURL
}

func getRedirectURL(r *http.Request) string {
	cookie, err := r.Cookie(defaultRedirectToCookieKey)
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
