package authn

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
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
)

const (
	MetaKeyUsername   = "username"
	MetaKeyAuthModule = "authModule"
)

// ClientParams are hints to the auth serviAuthN: Post login hooksce about how to handle the identity management
// from the authenticating client.
type ClientParams struct {
	// Update the internal representation of the entity from the identity provided
	SyncUser bool
	// Add entity to teams
	SyncTeamMembers bool
	// Create entity in the DB if it doesn't exist
	AllowSignUp bool
	// EnableDisabledUsers is a hint to the auth service that it should reenable disabled users
	EnableDisabledUsers bool
	// LookUpParams are the arguments used to look up the entity in the DB.
	LookUpParams models.UserLookupParams
}

type PostAuthHookFn func(ctx context.Context, identity *Identity, r *Request) error
type PostLoginHookFn func(ctx context.Context, identity *Identity, r *Request, err error)

type Service interface {
	// Authenticate authenticates a request using the specified client.
	Authenticate(ctx context.Context, client string, r *Request) (*Identity, bool, error)
	// RegisterPostAuthHook registers a hook that is called after a successful authentication.
	RegisterPostAuthHook(hook PostAuthHookFn)
	// Login authenticates a request and creates a session on successful authentication.
	Login(ctx context.Context, client string, r *Request) (*Identity, error)
	// RegisterPostLoginHook registers a hook that that is called after a login request.
	RegisterPostLoginHook(hook PostLoginHookFn)
}

type Client interface {
	// Authenticate performs the authentication for the request
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
	// Test should return true if client can be used to authenticate request
	Test(ctx context.Context, r *Request) bool
}

type PasswordClient interface {
	AuthenticatePassword(ctx context.Context, r *Request, username, password string) (*Identity, error)
}

type ProxyClient interface {
	AuthenticateProxy(ctx context.Context, r *Request, username string, additional map[string]string) (*Identity, error)
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
	// Login is the short hand identifier of the entity. Should be unique.
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
	SessionToken *auth.UserToken
	// ClientParams are hints for the auth service on how to handle the identity.
	// Set by the authenticating client.
	ClientParams ClientParams
}

// Role returns the role of the identity in the active organization.
func (i *Identity) Role() org.RoleType {
	return i.OrgRoles[i.OrgID]
}

// IsAnonymous will return true if no ID is set on the identity
func (i *Identity) IsAnonymous() bool {
	return i.ID == ""
}

// TODO: improve error handling
func (i *Identity) NamespacedID() (string, int64) {
	var (
		id        int64
		namespace string
	)

	split := strings.Split(i.ID, ":")
	if len(split) != 2 {
		return "", -1
	}

	id, errI := strconv.ParseInt(split[1], 10, 64)
	if errI != nil {
		return "", -1
	}

	namespace = split[0]

	return namespace, id
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
		IsAnonymous:        i.IsAnonymous(),
		IsDisabled:         i.IsDisabled,
		HelpFlags1:         i.HelpFlags1,
		LastSeenAt:         i.LastSeenAt,
		Teams:              i.Teams,
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

func (i *Identity) ExternalUserInfo() models.ExternalUserInfo {
	_, id := i.NamespacedID()
	return models.ExternalUserInfo{
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
	}
}
