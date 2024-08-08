package user

import (
	"fmt"
	"strconv"
	"time"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	GlobalOrgID = int64(0)
)

var _ identity.Requester = &SignedInUser{}

type SignedInUser struct {
	UserID        int64  `xorm:"user_id"`
	UserUID       string `xorm:"user_uid"`
	OrgID         int64  `xorm:"org_id"`
	OrgName       string
	OrgRole       identity.RoleType
	Login         string
	Name          string
	Email         string
	EmailVerified bool
	// AuthID will be set if user signed in using external method
	AuthID string
	// AuthenticatedBy be set if user signed in using external method
	AuthenticatedBy            string
	AllowedKubernetesNamespace string

	ApiKeyID         int64 `xorm:"api_key_id"`
	IsServiceAccount bool  `xorm:"is_service_account"`
	IsGrafanaAdmin   bool
	IsAnonymous      bool
	IsDisabled       bool
	HelpFlags1       HelpFlags1
	LastSeenAt       time.Time
	Teams            []int64
	// Permissions grouped by orgID and actions
	Permissions map[int64]map[string][]string `json:"-"`

	// IDToken is a signed token representing the identity that can be forwarded to plugins and external services.
	// Will only be set when featuremgmt.FlagIdForwarding is enabled.
	IDToken       string                                   `json:"-" xorm:"-"`
	IDTokenClaims *authnlib.Claims[authnlib.IDTokenClaims] `json:"-" xorm:"-"`

	// When other settings are not deterministic, this value is used
	FallbackType identity.IdentityType
}

// GetRawIdentifier implements Requester.
func (u *SignedInUser) GetRawIdentifier() string {
	if u.UserUID == "" {
		// nolint:staticcheck
		id, _ := u.GetInternalID()
		return strconv.FormatInt(id, 10)
	}
	return u.UserUID
}

// Deprecated: use GetUID
func (u *SignedInUser) GetInternalID() (int64, error) {
	switch {
	case u.ApiKeyID != 0:
		return u.ApiKeyID, nil
	case u.IsAnonymous:
		return 0, nil
	default:
	}
	return u.UserID, nil
}

// GetIdentityType implements Requester.
func (u *SignedInUser) GetIdentityType() identity.IdentityType {
	switch {
	case u.ApiKeyID != 0:
		return identity.TypeAPIKey
	case u.IsServiceAccount:
		return identity.TypeServiceAccount
	case u.UserID > 0:
		return identity.TypeUser
	case u.IsAnonymous:
		return identity.TypeAnonymous
	case u.AuthenticatedBy == "render" && u.UserID == 0:
		return identity.TypeRenderService
	}
	return u.FallbackType
}

// GetName implements identity.Requester.
func (u *SignedInUser) GetName() string {
	return u.Name
}

// GetExtra implements Requester.
func (u *SignedInUser) GetExtra() map[string][]string {
	extra := map[string][]string{}
	if u.IDToken != "" {
		extra["id-token"] = []string{u.IDToken}
	}
	if u.OrgRole.IsValid() {
		extra["user-instance-role"] = []string{string(u.GetOrgRole())}
	}
	return extra
}

// GetGroups implements Requester.
func (u *SignedInUser) GetGroups() []string {
	groups := []string{}
	for _, t := range u.Teams {
		groups = append(groups, strconv.FormatInt(t, 10))
	}
	return groups
}

func (u *SignedInUser) ShouldUpdateLastSeenAt() bool {
	return u.UserID > 0 && time.Since(u.LastSeenAt) > time.Minute*5
}

func (u *SignedInUser) NameOrFallback() string {
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

func (u *SignedInUser) HasRole(role identity.RoleType) bool {
	if u.IsGrafanaAdmin {
		return true
	}

	return u.OrgRole.Includes(role)
}

// IsRealUser returns true if the entity is a real user and not a service account
func (u *SignedInUser) IsRealUser() bool {
	// backwards compatibility
	// checking if userId the user is a real user
	// previously we used to check if the UserId was 0 or -1
	// and not a service account
	return u.UserID > 0 && !u.IsServiceAccountUser()
}

func (u *SignedInUser) IsApiKeyUser() bool {
	return u.ApiKeyID > 0
}

// IsServiceAccountUser returns true if the entity is a service account
func (u *SignedInUser) IsServiceAccountUser() bool {
	return u.IsServiceAccount
}

// HasUniqueId returns true if the entity has a unique id
func (u *SignedInUser) HasUniqueId() bool {
	return u.IsRealUser() || u.IsApiKeyUser() || u.IsServiceAccountUser()
}

func (u *SignedInUser) GetAllowedKubernetesNamespace() string {
	return u.AllowedKubernetesNamespace
}

// GetCacheKey returns a unique key for the entity.
// Add an extra prefix to avoid collisions with other caches
func (u *SignedInUser) GetCacheKey() string {
	namespace, id := u.GetTypedID()
	if !u.HasUniqueId() {
		// Hack use the org role as id for identities that do not have a unique id
		// e.g. anonymous and render key.
		orgRole := u.GetOrgRole()
		if orgRole == "" {
			orgRole = identity.RoleNone
		}

		id = string(orgRole)
	}

	return fmt.Sprintf("%d-%s-%s", u.GetOrgID(), namespace, id)
}

// GetIsGrafanaAdmin returns true if the user is a server admin
func (u *SignedInUser) GetIsGrafanaAdmin() bool {
	return u.IsGrafanaAdmin
}

// GetLogin returns the login of the active entity
// Can be empty if the user is anonymous
func (u *SignedInUser) GetLogin() string {
	return u.Login
}

// GetOrgID returns the ID of the active organization
func (u *SignedInUser) GetOrgID() int64 {
	return u.OrgID
}

// DEPRECATED: GetOrgName returns the name of the active organization
// Retrieve the organization name from the organization service instead of using this method.
func (u *SignedInUser) GetOrgName() string {
	return u.OrgName
}

// GetPermissions returns the permissions of the active entity
func (u *SignedInUser) GetPermissions() map[string][]string {
	if u.Permissions == nil {
		return make(map[string][]string)
	}

	if u.Permissions[u.GetOrgID()] == nil {
		return make(map[string][]string)
	}

	return u.Permissions[u.GetOrgID()]
}

// GetGlobalPermissions returns the permissions of the active entity that are available across all organizations
func (u *SignedInUser) GetGlobalPermissions() map[string][]string {
	if u.Permissions == nil {
		return make(map[string][]string)
	}

	if u.Permissions[GlobalOrgID] == nil {
		return make(map[string][]string)
	}

	return u.Permissions[GlobalOrgID]
}

// DEPRECATED: GetTeams returns the teams the entity is a member of
// Retrieve the teams from the team service instead of using this method.
func (u *SignedInUser) GetTeams() []int64 {
	return u.Teams
}

// GetOrgRole returns the role of the active entity in the active organization
func (u *SignedInUser) GetOrgRole() identity.RoleType {
	return u.OrgRole
}

// GetID returns namespaced id for the entity
func (u *SignedInUser) GetID() identity.TypedID {
	ns, id := u.GetTypedID()
	return identity.NewTypedIDString(ns, id)
}

// GetTypedID returns the namespace and ID of the active entity
// The namespace is one of the constants defined in pkg/apimachinery/identity
func (u *SignedInUser) GetTypedID() (identity.IdentityType, string) {
	switch {
	case u.ApiKeyID != 0:
		return identity.TypeAPIKey, strconv.FormatInt(u.ApiKeyID, 10)
	case u.IsServiceAccount:
		return identity.TypeServiceAccount, strconv.FormatInt(u.UserID, 10)
	case u.UserID > 0:
		return identity.TypeUser, strconv.FormatInt(u.UserID, 10)
	case u.IsAnonymous:
		return identity.TypeAnonymous, "0"
	case u.AuthenticatedBy == "render" && u.UserID == 0:
		return identity.TypeRenderService, "0"
	}

	return u.FallbackType, strconv.FormatInt(u.UserID, 10)
}

func (u *SignedInUser) GetUID() string {
	return fmt.Sprintf("%s:%s", u.GetIdentityType(), u.GetRawIdentifier())
}

func (u *SignedInUser) GetAuthID() string {
	return u.AuthID
}

func (u *SignedInUser) GetAuthenticatedBy() string {
	return u.AuthenticatedBy
}

func (u *SignedInUser) IsAuthenticatedBy(providers ...string) bool {
	for _, p := range providers {
		if u.AuthenticatedBy == p {
			return true
		}
	}
	return false
}

// FIXME: remove this method once all services are using an interface
func (u *SignedInUser) IsNil() bool {
	return u == nil
}

// GetEmail returns the email of the active entity
// Can be empty.
func (u *SignedInUser) GetEmail() string {
	return u.Email
}

func (u *SignedInUser) IsEmailVerified() bool {
	return u.EmailVerified
}

// GetDisplayName returns the display name of the active entity
// The display name is the name if it is set, otherwise the login or email
func (u *SignedInUser) GetDisplayName() string {
	return u.NameOrFallback()
}

func (u *SignedInUser) GetIDToken() string {
	return u.IDToken
}

func (u *SignedInUser) GetIDClaims() *authnlib.Claims[authnlib.IDTokenClaims] {
	return u.IDTokenClaims
}
