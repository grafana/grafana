package identity

import (
	"fmt"
	"strconv"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
)

var _ Requester = (*StaticRequester)(nil)

// StaticRequester allows creating requester values explicitly.
// It is helpful in tests!
// This is mostly copied from:
// https://github.com/grafana/grafana/blob/v11.0.0/pkg/services/user/identity.go#L16
type StaticRequester struct {
	Type            claims.IdentityType
	UserID          int64
	UserUID         string
	OrgID           int64
	OrgName         string
	OrgRole         RoleType
	Login           string
	Name            string
	Email           string
	EmailVerified   bool
	AuthID          string
	AuthenticatedBy string
	Namespace       string
	IsGrafanaAdmin  bool
	// Permissions grouped by orgID and actions
	Permissions       map[int64]map[string][]string
	IDToken           string
	IDTokenClaims     *authnlib.Claims[authnlib.IDTokenClaims]
	AccessTokenClaims *authnlib.Claims[authnlib.AccessTokenClaims]
	CacheKey          string
}

// GetID returns typed id for the entity
func (u *StaticRequester) GetID() string {
	return claims.NewTypeID(u.Type, strconv.FormatInt(u.UserID, 10))
}

func (u *StaticRequester) GetUID() string {
	return claims.NewTypeID(u.Type, u.UserUID)
}

func (u *StaticRequester) GetIdentifier() string {
	return u.UserUID
}

func (u *StaticRequester) GetIdentityType() claims.IdentityType {
	return u.Type
}

func (u *StaticRequester) GetSubject() string {
	return claims.NewTypeID(u.Type, strconv.FormatInt(u.UserID, 10))
}

func (u *StaticRequester) GetAudience() []string {
	return []string{fmt.Sprintf("org:%d", u.OrgID)}
}

func (u *StaticRequester) GetTokenPermissions() []string {
	if u.AccessTokenClaims != nil {
		return u.AccessTokenClaims.Rest.Permissions
	}
	return []string{}
}

func (u *StaticRequester) GetTokenDelegatedPermissions() []string {
	if u.AccessTokenClaims != nil {
		return u.AccessTokenClaims.Rest.DelegatedPermissions
	}
	return []string{}
}

func (u *StaticRequester) GetEmail() string {
	return u.Email
}

func (u *StaticRequester) GetEmailVerified() bool {
	return u.EmailVerified
}

func (u *StaticRequester) GetUsername() string {
	return u.Login
}

func (u *StaticRequester) GetRawIdentifier() string {
	return u.UserUID
}

func (u *StaticRequester) GetInternalID() (int64, error) {
	return u.UserID, nil
}

func (u *StaticRequester) IsIdentityType(expected ...claims.IdentityType) bool {
	return claims.IsIdentityType(u.GetIdentityType(), expected...)
}

func (u *StaticRequester) GetExtra() map[string][]string {
	if u.IDToken != "" {
		return map[string][]string{"id-token": {u.IDToken}}
	}
	return map[string][]string{}
}

func (u *StaticRequester) GetGroups() []string {
	return []string{}
}

func (u *StaticRequester) GetName() string {
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

func (u *StaticRequester) HasRole(role RoleType) bool {
	if u.IsGrafanaAdmin {
		return true
	}

	return u.OrgRole.Includes(role)
}

// GetIsGrafanaAdmin returns true if the user is a server admin
func (u *StaticRequester) GetIsGrafanaAdmin() bool {
	return u.IsGrafanaAdmin
}

// GetLogin returns the login of the active entity
// Can be empty if the user is anonymous
func (u *StaticRequester) GetLogin() string {
	return u.Login
}

// GetOrgID returns the ID of the active organization
func (u *StaticRequester) GetOrgID() int64 {
	return u.OrgID
}

// DEPRECATED: GetOrgName returns the name of the active organization
// Retrieve the organization name from the organization service instead of using this method.
func (u *StaticRequester) GetOrgName() string {
	return u.OrgName
}

// GetPermissions returns the permissions of the active entity
func (u *StaticRequester) GetPermissions() map[string][]string {
	if u.Permissions == nil {
		return make(map[string][]string)
	}

	if u.Permissions[u.GetOrgID()] == nil {
		return make(map[string][]string)
	}

	return u.Permissions[u.GetOrgID()]
}

// GetGlobalPermissions returns the permissions of the active entity that are available across all organizations
func (u *StaticRequester) GetGlobalPermissions() map[string][]string {
	if u.Permissions == nil {
		return make(map[string][]string)
	}

	const globalOrgID = 0

	if u.Permissions[globalOrgID] == nil {
		return make(map[string][]string)
	}

	return u.Permissions[globalOrgID]
}

// DEPRECATED: GetTeams returns the teams the entity is a member of
// Retrieve the teams from the team service instead of using this method.
func (u *StaticRequester) GetTeams() []int64 {
	return []int64{} // Not implemented
}

// GetOrgRole returns the role of the active entity in the active organization
func (u *StaticRequester) GetOrgRole() RoleType {
	return u.OrgRole
}

// HasUniqueId returns true if the entity has a unique id
func (u *StaticRequester) HasUniqueId() bool {
	return u.UserID > 0
}

func (u *StaticRequester) GetAuthID() string {
	return u.AuthID
}

func (u *StaticRequester) GetNamespace() string {
	return u.Namespace
}

func (u *StaticRequester) GetAuthenticatedBy() string {
	return u.AuthenticatedBy
}

func (u *StaticRequester) IsAuthenticatedBy(providers ...string) bool {
	for _, p := range providers {
		if u.AuthenticatedBy == p {
			return true
		}
	}
	return false
}

// FIXME: remove this method once all services are using an interface
func (u *StaticRequester) IsNil() bool {
	return u == nil
}

func (u *StaticRequester) IsEmailVerified() bool {
	return u.EmailVerified
}

func (u *StaticRequester) GetCacheKey() string {
	return u.CacheKey
}

func (u *StaticRequester) GetIDToken() string {
	return u.IDToken
}
