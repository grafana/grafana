package authn

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

const GlobalOrgID = int64(0)

var _ identity.Requester = (*Identity)(nil)

type Identity struct {
	// ID is the unique identifier for the entity in the Grafana database.
	ID string
	// UID is a unique identifier stored for the entity in Grafana database. Not all entities support uid so it can be empty.
	UID string
	// Type is the IdentityType of entity.
	Type claims.IdentityType
	// OrgID is the active organization for the entity.
	OrgID int64
	// OrgName is the name of the active organization.
	OrgName string
	// OrgRoles is the list of organizations the entity is a member of and their roles.
	OrgRoles map[int64]org.RoleType
	// Login is the shorthand identifier of the entity. Should be unique.
	Login string
	// Name is the display name of the entity. It is not guaranteed to be unique.
	Name string
	// Email is the email address of the entity. Should be unique.
	Email string
	// EmailVerified is true if entity has verified their email with grafana.
	EmailVerified bool
	// IsGrafanaAdmin is true if the entity is a Grafana admin.
	IsGrafanaAdmin *bool
	// AuthenticatedBy is the name of the authentication client that was used to authenticate the current Identity.
	// For example, "password", "apikey", "auth_ldap" or "auth_azuread".
	AuthenticatedBy string
	// AuthId is the unique identifier for the entity in the external system.
	// Empty if the identity is provided by Grafana.
	AuthID string
	// AllowedKubernetesNamespace
	AllowedKubernetesNamespace string
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
	IDToken       string
	IDTokenClaims *authn.Claims[authn.IDTokenClaims]

	AccessTokenClaims *authn.Claims[authn.AccessTokenClaims]
}

// Access implements claims.AuthInfo.
func (i *Identity) GetAccess() claims.AccessClaims {
	if i.AccessTokenClaims != nil {
		return authn.NewAccessClaims(*i.AccessTokenClaims)
	}
	return &identity.IDClaimsWrapper{Source: i}
}

// Identity implements claims.AuthInfo.
func (i *Identity) GetIdentity() claims.IdentityClaims {
	if i.IDTokenClaims != nil {
		return authn.NewIdentityClaims(*i.IDTokenClaims)
	}
	return &identity.IDClaimsWrapper{Source: i}
}

// GetRawIdentifier implements Requester.
func (i *Identity) GetRawIdentifier() string {
	return i.UID
}

// GetInternalID implements Requester.
func (i *Identity) GetInternalID() (int64, error) {
	return identity.IntIdentifier(i.GetID())
}

// GetIdentityType implements Requester.
func (i *Identity) GetIdentityType() claims.IdentityType {
	return i.Type
}

// GetIdentityType implements Requester.
func (i *Identity) IsIdentityType(expected ...claims.IdentityType) bool {
	return claims.IsIdentityType(i.GetIdentityType(), expected...)
}

// GetExtra implements identity.Requester.
func (i *Identity) GetExtra() map[string][]string {
	extra := map[string][]string{}
	if i.IDToken != "" {
		extra["id-token"] = []string{i.IDToken}
	}
	if i.GetOrgRole().IsValid() {
		extra["user-instance-role"] = []string{string(i.GetOrgRole())}
	}
	return extra
}

// GetGroups implements identity.Requester.
func (i *Identity) GetGroups() []string {
	return []string{} // teams?
}

// GetName implements identity.Requester.
func (i *Identity) GetName() string {
	return i.Name
}

func (i *Identity) GetID() string {
	return identity.NewTypedIDString(i.Type, i.ID)
}

func (i *Identity) GetUID() string {
	return identity.NewTypedIDString(i.Type, i.UID)
}

func (i *Identity) GetAuthID() string {
	return i.AuthID
}

func (i *Identity) GetAuthenticatedBy() string {
	return i.AuthenticatedBy
}

func (i *Identity) GetCacheKey() string {
	id := i.ID
	if !i.HasUniqueId() {
		// Hack use the org role as id for identities that do not have a unique id
		// e.g. anonymous and render key.
		id = string(i.GetOrgRole())
	}

	return fmt.Sprintf("%d-%s-%s", i.GetOrgID(), i.Type, id)
}

func (i *Identity) GetDisplayName() string {
	return i.Name
}

func (i *Identity) GetEmail() string {
	return i.Email
}

func (i *Identity) IsEmailVerified() bool {
	return i.EmailVerified
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

func (i *Identity) GetAllowedKubernetesNamespace() string {
	return i.AllowedKubernetesNamespace
}

func (i *Identity) GetOrgID() int64 {
	return i.OrgID
}

func (i *Identity) GetOrgName() string {
	return i.OrgName
}

func (i *Identity) GetOrgRole() org.RoleType {
	if i.OrgRoles == nil {
		return org.RoleNone
	}

	if i.OrgRoles[i.GetOrgID()] == "" {
		return org.RoleNone
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

// GetGlobalPermissions returns the permissions of the active entity that are available across all organizations
func (i *Identity) GetGlobalPermissions() map[string][]string {
	if i.Permissions == nil {
		return make(map[string][]string)
	}

	if i.Permissions[GlobalOrgID] == nil {
		return make(map[string][]string)
	}

	return i.Permissions[GlobalOrgID]
}

func (i *Identity) GetTeams() []int64 {
	return i.Teams
}

func (i *Identity) HasRole(role org.RoleType) bool {
	if i.GetIsGrafanaAdmin() {
		return true
	}

	return i.GetOrgRole().Includes(role)
}

func (i *Identity) HasUniqueId() bool {
	return i.IsIdentityType(claims.TypeUser, claims.TypeAPIKey, claims.TypeServiceAccount)
}

func (i *Identity) IsAuthenticatedBy(providers ...string) bool {
	for _, p := range providers {
		if i.AuthenticatedBy == p {
			return true
		}
	}
	return false
}

func (i *Identity) IsNil() bool {
	return i == nil
}

// SignedInUser returns a SignedInUser from the identity.
func (i *Identity) SignedInUser() *user.SignedInUser {
	u := &user.SignedInUser{
		OrgID:           i.OrgID,
		OrgName:         i.OrgName,
		OrgRole:         i.GetOrgRole(),
		Login:           i.Login,
		Name:            i.Name,
		Email:           i.Email,
		AuthID:          i.AuthID,
		AuthenticatedBy: i.AuthenticatedBy,
		IsGrafanaAdmin:  i.GetIsGrafanaAdmin(),
		IsAnonymous:     i.IsIdentityType(claims.TypeAnonymous),
		IsDisabled:      i.IsDisabled,
		HelpFlags1:      i.HelpFlags1,
		LastSeenAt:      i.LastSeenAt,
		Teams:           i.Teams,
		Permissions:     i.Permissions,
		IDToken:         i.IDToken,
		FallbackType:    i.Type,
	}

	if i.IsIdentityType(claims.TypeAPIKey) {
		id, _ := i.GetInternalID()
		u.ApiKeyID = id
	} else {
		id, _ := i.GetInternalID()
		u.UserID = id
		u.UserUID = i.UID
		u.IsServiceAccount = i.IsIdentityType(claims.TypeServiceAccount)
	}

	return u
}

func (i *Identity) ExternalUserInfo() login.ExternalUserInfo {
	id, _ := strconv.ParseInt(i.ID, 10, 64)
	return login.ExternalUserInfo{
		OAuthToken:     i.OAuthToken,
		AuthModule:     i.AuthenticatedBy,
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
