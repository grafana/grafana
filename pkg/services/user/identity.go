package user

import (
	"fmt"
	"strconv"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	GlobalOrgID = int64(0)
)

var _ identity.Requester = (*SignedInUser)(nil)

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
	AuthenticatedBy string
	Namespace       string

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
	IDToken           string                                       `json:"-" xorm:"-"`
	IDTokenClaims     *authnlib.Claims[authnlib.IDTokenClaims]     `json:"-" xorm:"-"`
	AccessTokenClaims *authnlib.Claims[authnlib.AccessTokenClaims] `json:"-" xorm:"-"`

	// When other settings are not deterministic, this value is used
	FallbackType claims.IdentityType
}

func (u *SignedInUser) GetID() string {
	ns, id := u.getTypeAndID()
	return claims.NewTypeID(ns, id)
}

func (u *SignedInUser) GetInternalID() (int64, error) {
	return identity.IntIdentifier(u.GetID())
}

func (u *SignedInUser) GetUID() string {
	return claims.NewTypeID(u.GetIdentityType(), u.GetIdentifier())
}

func (u *SignedInUser) GetIdentifier() string {
	if u.UserUID == "" {
		// nolint:staticcheck
		id, _ := u.GetInternalID()
		return strconv.FormatInt(id, 10)
	}
	return u.UserUID
}

func (u *SignedInUser) GetRawIdentifier() string {
	return u.GetIdentifier()
}

func (u *SignedInUser) GetIdentityType() claims.IdentityType {
	switch {
	case u.ApiKeyID != 0:
		return claims.TypeAPIKey
	case u.IsServiceAccount:
		return claims.TypeServiceAccount
	case u.UserID > 0:
		return claims.TypeUser
	case u.IsAnonymous:
		return claims.TypeAnonymous
	case u.AuthenticatedBy == "render" && u.UserID == 0:
		return claims.TypeRenderService
	}
	return u.FallbackType
}

func (u *SignedInUser) IsIdentityType(expected ...claims.IdentityType) bool {
	return claims.IsIdentityType(u.GetIdentityType(), expected...)
}

func (u *SignedInUser) GetName() string {
	// kubernetesAggregator feature flag which allows Cloud Apps to become available
	// in single tenant Grafana requires that GetName() returns something and not an empty string
	// the logic below ensures that something is returned
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

func (u *SignedInUser) GetNamespace() string {
	return u.Namespace
}

func (u *SignedInUser) GetSubject() string {
	return u.GetID()
}

func (u *SignedInUser) GetAudience() []string {
	if u.AccessTokenClaims != nil {
		return u.AccessTokenClaims.Audience
	}
	return []string{}
}

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

func (u *SignedInUser) GetGroups() []string {
	groups := []string{}
	for _, t := range u.Teams {
		groups = append(groups, strconv.FormatInt(t, 10))
	}
	return groups
}

func (u *SignedInUser) GetTokenPermissions() []string {
	if u.AccessTokenClaims != nil {
		return u.AccessTokenClaims.Rest.Permissions
	}
	return []string{}
}

func (u *SignedInUser) GetTokenDelegatedPermissions() []string {
	if u.AccessTokenClaims != nil {
		return u.AccessTokenClaims.Rest.DelegatedPermissions
	}
	return []string{}
}

func (u *SignedInUser) GetEmail() string {
	return u.Email
}

func (u *SignedInUser) GetEmailVerified() bool {
	return u.EmailVerified
}

func (u *SignedInUser) ShouldUpdateLastSeenAt() bool {
	return u.UserID > 0 && time.Since(u.LastSeenAt) > time.Minute*5
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

// GetCacheKey returns a unique key for the entity.
// Add an extra prefix to avoid collisions with other caches
func (u *SignedInUser) GetCacheKey() string {
	typ, id := u.getTypeAndID()
	if !u.HasUniqueId() {
		// Hack use the org role as id for identities that do not have a unique id
		// e.g. anonymous and render key.
		orgRole := u.GetOrgRole()
		if orgRole == "" {
			orgRole = identity.RoleNone
		}

		id = string(orgRole)
	}

	return fmt.Sprintf("%d-%s-%s", u.GetOrgID(), typ, id)
}

func (u *SignedInUser) GetIsGrafanaAdmin() bool {
	return u.IsGrafanaAdmin
}

// GetLogin returns the login of the active entity
// Can be empty if the user is anonymous
func (u *SignedInUser) GetLogin() string {
	return u.Login
}

// GetUsername implements identity.Requester.
func (u *SignedInUser) GetUsername() string {
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

func (u *SignedInUser) getTypeAndID() (claims.IdentityType, string) {
	switch {
	case u.ApiKeyID != 0:
		return claims.TypeAPIKey, strconv.FormatInt(u.ApiKeyID, 10)
	case u.IsServiceAccount:
		return claims.TypeServiceAccount, strconv.FormatInt(u.UserID, 10)
	case u.UserID > 0:
		return claims.TypeUser, strconv.FormatInt(u.UserID, 10)
	case u.IsAnonymous:
		return claims.TypeAnonymous, "0"
	case u.AuthenticatedBy == "render" && u.UserID == 0:
		return claims.TypeRenderService, "0"
	}

	return u.FallbackType, strconv.FormatInt(u.UserID, 10)
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

func (u *SignedInUser) GetIDToken() string {
	return u.IDToken
}
