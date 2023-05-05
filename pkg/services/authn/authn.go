package authn

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const (
	ClientAPIKey    = "auth.client.api-key" // #nosec G101
	ClientAnonymous = "auth.client.anonymous"
	ClientBasic     = "auth.client.basic"
	ClientJWT       = "auth.client.jwt"
	ClientRender    = "auth.client.render"
	ClientSession   = "auth.client.session"
	ClientForm      = "auth.client.form"
	ClientProxy     = "auth.client.proxy"
	ClientSAML      = "auth.client.saml"
)

const (
	MetaKeyUsername   = "username"
	MetaKeyAuthModule = "authModule"
)

// ClientParams are hints to the auth service about how to handle the identity management
// from the authenticating client.
type ClientParams struct {
	// SyncUser updates the internal representation of the identity from the identity provided
	SyncUser bool
	// AllowSignUp Adds identity to DB if it doesn't exist when, only work if SyncUser is enabled
	AllowSignUp bool
	// EnableDisabledUsers will enable disabled user, only work if SyncUser is enabled
	EnableDisabledUsers bool
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
	UsageStatFn(ctx context.Context) (map[string]interface{}, error)
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

const (
	NamespaceUser           = "user"
	NamespaceAPIKey         = "api-key"
	NamespaceServiceAccount = "service-account"
)

type Identity struct {
	// OrgID is the active organization for the entity.
	OrgID int64
	// OrgCount is the number of organizations the entity is a member of.
	OrgCount int
	// OrgName is the name of the active organization.
	OrgName string
	// OrgRoles is the list of organizations the entity is a member of and their roles.
	OrgRoles map[int64]org.RoleType
	// ID is the unique identifier for the entity in the Grafana database.
	// It is in the format <namespace>:<id> where namespace is one of the
	// Namespace* constants. For example, "user:1" or "api-key:1".
	// If the entity is not found in the DB or this entity is non-persistent, this field will be empty.
	ID string
	// IsAnonymous
	IsAnonymous bool
	// Login is the shorthand identifier of the entity. Should be unique.
	Login string
	// Name is the display name of the entity. It is not guaranteed to be unique.
	Name string
	// Email is the email address of the entity. Should be unique.
	Email string
	// IsGrafanaAdmin is true if the entity is a Grafana admin.
	IsGrafanaAdmin *bool
	// AuthModule is the name of the external system. For example, "auth_ldap" or "auth_saml".
	// Empty if the identity is provided by Grafana.
	AuthModule string
	// AuthId is the unique identifier for the entity in the external system.
	// Empty if the identity is provided by Grafana.
	AuthID string
	// IsDisabled is true if the entity is disabled.
	IsDisabled bool
	// HelpFlags1 is the help flags for the entity.
	HelpFlags1 user.HelpFlags1
	// LastSeenAt is the time when the entity was last seen.
	LastSeenAt time.Time
	// Teams is the list of teams the entity is a member of.
	Teams []int64
	// idP Groups that the entity is a member of. This is only populated if the
	// identity provider supports groups.
	Groups []string
	// OAuthToken is the OAuth token used to authenticate the entity.
	OAuthToken *oauth2.Token
	// SessionToken is the session token used to authenticate the entity.
	SessionToken *usertoken.UserToken
	// ClientParams are hints for the auth service on how to handle the identity.
	// Set by the authenticating client.
	ClientParams ClientParams
	// Permissions is the list of permissions the entity has.
	Permissions map[int64]map[string][]string
}

// Role returns the role of the identity in the active organization.
func (i *Identity) Role() org.RoleType {
	return i.OrgRoles[i.OrgID]
}

// NamespacedID returns the namespace, e.g. "user" and the id for that namespace
func (i *Identity) NamespacedID() (string, int64) {
	split := strings.Split(i.ID, ":")
	if len(split) != 2 {
		return "", -1
	}

	id, err := strconv.ParseInt(split[1], 10, 64)
	if err != nil {
		// FIXME (kalleep): Improve error handling
		return "", -1
	}

	return split[0], id
}

// NamespacedID builds a namespaced ID from a namespace and an ID.
func NamespacedID(namespace string, id int64) string {
	return fmt.Sprintf("%s:%d", namespace, id)
}

// SignedInUser returns a SignedInUser from the identity.
func (i *Identity) SignedInUser() *user.SignedInUser {
	var isGrafanaAdmin bool
	if i.IsGrafanaAdmin != nil {
		isGrafanaAdmin = *i.IsGrafanaAdmin
	}

	u := &user.SignedInUser{
		UserID:             0,
		OrgID:              i.OrgID,
		OrgName:            i.OrgName,
		OrgRole:            i.Role(),
		ExternalAuthModule: i.AuthModule,
		ExternalAuthID:     i.AuthID,
		Login:              i.Login,
		Name:               i.Name,
		Email:              i.Email,
		OrgCount:           i.OrgCount,
		IsGrafanaAdmin:     isGrafanaAdmin,
		IsAnonymous:        i.IsAnonymous,
		IsDisabled:         i.IsDisabled,
		HelpFlags1:         i.HelpFlags1,
		LastSeenAt:         i.LastSeenAt,
		Teams:              i.Teams,
		Permissions:        i.Permissions,
	}

	namespace, id := i.NamespacedID()
	if namespace == NamespaceAPIKey {
		u.ApiKeyID = id
	} else {
		u.UserID = id
		u.IsServiceAccount = namespace == NamespaceServiceAccount
	}

	return u
}

func (i *Identity) ExternalUserInfo() login.ExternalUserInfo {
	_, id := i.NamespacedID()
	return login.ExternalUserInfo{
		OAuthToken:     i.OAuthToken,
		AuthModule:     i.AuthModule,
		AuthId:         i.AuthID,
		UserId:         id,
		Email:          i.Email,
		Login:          i.Login,
		Name:           i.Name,
		Groups:         i.Groups,
		OrgRoles:       i.OrgRoles,
		IsGrafanaAdmin: i.IsGrafanaAdmin,
		IsDisabled:     i.IsDisabled,
	}
}

// IdentityFromSignedInUser creates an identity from a SignedInUser.
func IdentityFromSignedInUser(id string, usr *user.SignedInUser, params ClientParams) *Identity {
	return &Identity{
		ID:             id,
		OrgID:          usr.OrgID,
		OrgName:        usr.OrgName,
		OrgRoles:       map[int64]org.RoleType{usr.OrgID: usr.OrgRole},
		Login:          usr.Login,
		Name:           usr.Name,
		Email:          usr.Email,
		OrgCount:       usr.OrgCount,
		IsGrafanaAdmin: &usr.IsGrafanaAdmin,
		IsDisabled:     usr.IsDisabled,
		HelpFlags1:     usr.HelpFlags1,
		LastSeenAt:     usr.LastSeenAt,
		Teams:          usr.Teams,
		ClientParams:   params,
		Permissions:    usr.Permissions,
	}
}

// ClientWithPrefix returns a client name prefixed with "auth.client."
func ClientWithPrefix(name string) string {
	return fmt.Sprintf("auth.client.%s", name)
}

type RedirectValidator func(url string) error

// HandleLoginResponse is a utility function to perform common operations after a successful login and returns response.NormalResponse
func HandleLoginResponse(r *http.Request, w http.ResponseWriter, cfg *setting.Cfg, identity *Identity, validator RedirectValidator) *response.NormalResponse {
	result := map[string]interface{}{"message": "Logged in"}
	if redirectURL := handleLogin(r, w, cfg, identity, validator); redirectURL != cfg.AppSubURL+"/" {
		result["redirectUrl"] = redirectURL
	}
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
	if redirectTo := getRedirectURL(r); len(redirectTo) > 0 && validator(redirectTo) == nil {
		cookies.DeleteCookie(w, "redirect_to", nil)
		redirectURL = redirectTo
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
		opts := cookies.NewCookieOptions()
		opts.NotHttpOnly = true
		return opts
	})
}

func DeleteSessionCookie(w http.ResponseWriter, cfg *setting.Cfg) {
	cookies.DeleteCookie(w, cfg.LoginCookieName, nil)
	cookies.DeleteCookie(w, sessionExpiryCookie, func() cookies.CookieOptions {
		opts := cookies.NewCookieOptions()
		opts.NotHttpOnly = true
		return opts
	})
}
