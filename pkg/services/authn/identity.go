package authn

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// NamespacedID builds a namespaced ID from a namespace and an ID.
func NamespacedID(namespace string, id int64) string {
	return fmt.Sprintf("%s:%d", namespace, id)
}

const (
	NamespaceUser           = identity.NamespaceUser
	NamespaceAPIKey         = identity.NamespaceAPIKey
	NamespaceServiceAccount = identity.NamespaceServiceAccount
	NamespaceAnonymous      = identity.NamespaceAnonymous
	NamespaceRenderService  = identity.NamespaceRenderService
)

const (
	AnonymousNamespaceID = NamespaceAnonymous + ":0"
)

var _ identity.Requester = (*Identity)(nil)

type Identity struct {
	// OrgID is the active organization for the entity.
	OrgID int64
	// OrgName is the name of the active organization.
	OrgName string
	// OrgRoles is the list of organizations the entity is a member of and their roles.
	OrgRoles map[int64]org.RoleType
	// ID is the unique identifier for the entity in the Grafana database.
	// It is in the format <namespace>:<id> where namespace is one of the
	// Namespace* constants. For example, "user:1" or "api-key:1".
	// If the entity is not found in the DB or this entity is non-persistent, this field will be empty.
	ID string
	// Login is the shorthand identifier of the entity. Should be unique.
	Login string
	// Name is the display name of the entity. It is not guaranteed to be unique.
	Name string
	// Email is the email address of the entity. Should be unique.
	Email string
	// IsGrafanaAdmin is true if the entity is a Grafana admin.
	IsGrafanaAdmin *bool
	// AuthenticatedBy is the name of the authentication client that was used to authenticate the current Identity.
	// For example, "password", "apikey", "auth_ldap" or "auth_azuread".
	AuthenticatedBy string
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
	// IDToken is a signed token representing the identity that can be forwarded to plugins and external services.
	// Will only be set when featuremgmt.FlagIdForwarding is enabled.
	IDToken string
}

func (i *Identity) GetAuthenticatedBy() string {
	return i.AuthenticatedBy
}

func (i *Identity) GetCacheKey() string {
	namespace, id := i.GetNamespacedID()
	if !i.HasUniqueId() {
		// Hack use the org role as id for identities that do not have a unique id
		// e.g. anonymous and render key.
		id = string(i.GetOrgRole())
	}

	return fmt.Sprintf("%d-%s-%s", i.GetOrgID(), namespace, id)
}

func (i *Identity) GetDisplayName() string {
	return i.Name
}

func (i *Identity) GetEmail() string {
	return i.Email
}

func (i *Identity) GetIDToken() string {
	return i.IDToken
}

func (i *Identity) GetIsGrafanaAdmin() bool {
	return i.IsGrafanaAdmin != nil && *i.IsGrafanaAdmin
}

func (i *Identity) GetLogin() string {
	return i.Login
}

func (i *Identity) GetNamespacedID() (namespace string, identifier string) {
	split := strings.Split(i.ID, ":")

	if len(split) != 2 {
		return "", ""
	}

	return split[0], split[1]
}

// GetOrgID implements identity.Requester.
func (i *Identity) GetOrgID() int64 {
	return i.OrgID
}

func (i *Identity) GetOrgName() string {
	return i.OrgName
}

func (i *Identity) GetOrgRole() roletype.RoleType {
	if i.OrgRoles == nil {
		return roletype.RoleNone
	}

	if i.OrgRoles[i.GetOrgID()] == "" {
		return roletype.RoleNone
	}

	return i.OrgRoles[i.GetOrgID()]
}

func (i *Identity) GetPermissions() map[string][]string {
	if i.Permissions == nil {
		return make(map[string][]string)
	}

	if i.Permissions[i.GetOrgID()] == nil {
		return make(map[string][]string)
	}

	return i.Permissions[i.GetOrgID()]
}

func (i *Identity) GetTeams() []int64 {
	return i.Teams
}

func (i *Identity) HasRole(role roletype.RoleType) bool {
	if i.GetIsGrafanaAdmin() {
		return true
	}

	return i.GetOrgRole().Includes(role)
}

func (i *Identity) HasUniqueId() bool {
	namespace, _ := i.GetNamespacedID()
	return namespace == NamespaceUser || namespace == NamespaceServiceAccount || namespace == NamespaceAPIKey
}

func (i *Identity) IsNil() bool {
	return i == nil
}

// NamespacedID returns the namespace, e.g. "user" and the id for that namespace
// FIXME(kalleep): Replace with GetNamespacedID
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

// SignedInUser returns a SignedInUser from the identity.
func (i *Identity) SignedInUser() *user.SignedInUser {
	namespace, id := i.GetNamespacedID()

	u := &user.SignedInUser{
		OrgID:           i.OrgID,
		OrgName:         i.OrgName,
		OrgRole:         i.GetOrgRole(),
		Login:           i.Login,
		Name:            i.Name,
		Email:           i.Email,
		AuthenticatedBy: i.AuthenticatedBy,
		IsGrafanaAdmin:  i.GetIsGrafanaAdmin(),
		IsAnonymous:     namespace == NamespaceAnonymous,
		IsDisabled:      i.IsDisabled,
		HelpFlags1:      i.HelpFlags1,
		LastSeenAt:      i.LastSeenAt,
		Teams:           i.Teams,
		Permissions:     i.Permissions,
		IDToken:         i.IDToken,
	}

	if namespace == NamespaceAPIKey {
		u.ApiKeyID = intIdentifier(id)
	} else {
		u.UserID = intIdentifier(id)
		u.IsServiceAccount = namespace == NamespaceServiceAccount
	}

	return u
}

func intIdentifier(identifier string) int64 {
	id, err := strconv.ParseInt(identifier, 10, 64)
	if err != nil {
		// FIXME (kalleep): Improve error handling
		return -1
	}

	return id
}

func (i *Identity) ExternalUserInfo() login.ExternalUserInfo {
	_, id := i.GetNamespacedID()
	return login.ExternalUserInfo{
		OAuthToken:     i.OAuthToken,
		AuthModule:     i.AuthenticatedBy,
		AuthId:         i.AuthID,
		UserId:         intIdentifier(id),
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
func IdentityFromSignedInUser(id string, usr *user.SignedInUser, params ClientParams, authenticatedBy string) *Identity {
	return &Identity{
		ID:              id,
		OrgID:           usr.OrgID,
		OrgName:         usr.OrgName,
		OrgRoles:        map[int64]org.RoleType{usr.OrgID: usr.OrgRole},
		Login:           usr.Login,
		Name:            usr.Name,
		Email:           usr.Email,
		AuthenticatedBy: authenticatedBy,
		IsGrafanaAdmin:  &usr.IsGrafanaAdmin,
		IsDisabled:      usr.IsDisabled,
		HelpFlags1:      usr.HelpFlags1,
		LastSeenAt:      usr.LastSeenAt,
		Teams:           usr.Teams,
		ClientParams:    params,
		Permissions:     usr.Permissions,
		IDToken:         usr.IDToken,
	}
}
