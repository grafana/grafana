package identity

import "fmt"

var _ Requester = &StaticRequester{}

// StaticRequester allows creating requester values explicitly.
// It is helpful in tests!
// This is mostly copied from:
// https://github.com/grafana/grafana/blob/v11.0.0/pkg/services/user/identity.go#L16
type StaticRequester struct {
	Kind                       IdentityType
	UserID                     int64
	UserUID                    string
	OrgID                      int64
	OrgName                    string
	OrgRole                    RoleType
	Login                      string
	Name                       string
	DisplayName                string
	Email                      string
	EmailVerified              bool
	AuthID                     string
	AuthenticatedBy            string
	AllowedKubernetesNamespace string
	IsGrafanaAdmin             bool
	// Permissions grouped by orgID and actions
	Permissions map[int64]map[string][]string
	IDToken     string
	CacheKey    string
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

// GetID returns namespaced id for the entity
func (u *StaticRequester) GetID() TypedID {
	return NewTypedIDString(u.Kind, fmt.Sprintf("%d", u.UserID))
}

// GetUID returns namespaced uid for the entity
func (u *StaticRequester) GetUID() TypedID {
	return NewTypedIDString(u.Kind, u.UserUID)
}

// GetTypedID returns the namespace and ID of the active entity
// The namespace is one of the constants defined in pkg/apimachinery/identity
func (u *StaticRequester) GetTypedID() (IdentityType, string) {
	return u.Kind, fmt.Sprintf("%d", u.UserID)
}

func (u *StaticRequester) GetAuthID() string {
	return u.AuthID
}

func (u *StaticRequester) GetAllowedKubernetesNamespace() string {
	return u.AllowedKubernetesNamespace
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

// GetEmail returns the email of the active entity
// Can be empty.
func (u *StaticRequester) GetEmail() string {
	return u.Email
}

func (u *StaticRequester) IsEmailVerified() bool {
	return u.EmailVerified
}

func (u *StaticRequester) GetCacheKey() string {
	return u.CacheKey
}

// GetDisplayName returns the display name of the active entity
// The display name is the name if it is set, otherwise the login or email
func (u *StaticRequester) GetDisplayName() string {
	if u.DisplayName != "" {
		return u.DisplayName
	}
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

func (u *StaticRequester) GetIDToken() string {
	return u.IDToken
}
