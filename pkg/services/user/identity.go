package user

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type SignedInUser struct {
	UserID           int64 `xorm:"user_id"`
	OrgID            int64 `xorm:"org_id"`
	OrgName          string
	OrgRole          roletype.RoleType
	Login            string
	Name             string
	Email            string
	AuthenticatedBy  string
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

func (u *SignedInUser) ToUserDisplayDTO() *UserDisplayDTO {
	return &UserDisplayDTO{
		ID:    u.UserID,
		Login: u.Login,
		Name:  u.Name,
	}
}

func (u *SignedInUser) HasRole(role roletype.RoleType) bool {
	if u.IsGrafanaAdmin {
		return true
	}

	return u.OrgRole.Includes(role)
}

// IsRealUser returns true if the user is a real user and not a service account
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

// IsServiceAccountUser returns true if the user is a service account
func (u *SignedInUser) IsServiceAccountUser() bool {
	return u.IsServiceAccount
}

func (u *SignedInUser) HasUniqueId() bool {
	return u.IsRealUser() || u.IsApiKeyUser() || u.IsServiceAccountUser()
}

func (u *SignedInUser) GetCacheKey() (string, error) {
	if u.IsRealUser() {
		return fmt.Sprintf("%d-user-%d", u.OrgID, u.UserID), nil
	}
	if u.IsApiKeyUser() {
		return fmt.Sprintf("%d-apikey-%d", u.OrgID, u.ApiKeyID), nil
	}
	if u.IsServiceAccountUser() { // not considered a real user
		return fmt.Sprintf("%d-service-%d", u.OrgID, u.UserID), nil
	}
	return "", ErrNoUniqueID
}

func (u *SignedInUser) GetIsGrafanaAdmin() bool {
	return u.IsGrafanaAdmin
}

func (u *SignedInUser) GetLogin() string {
	return u.Login
}

func (u *SignedInUser) GetOrgID() int64 {
	return u.OrgID
}

func (u *SignedInUser) GetPermissions() map[string][]string {
	if u.Permissions == nil {
		return make(map[string][]string)
	}

	if u.Permissions[u.GetOrgID()] == nil {
		return make(map[string][]string)
	}

	return u.Permissions[u.GetOrgID()]
}

func (u *SignedInUser) GetTeams() []int64 {
	return u.Teams
}

func (u *SignedInUser) GetOrgRole() roletype.RoleType {
	return u.OrgRole
}

func (u *SignedInUser) GetNamespacedID() (string, string) {
	switch {
	case u.ApiKeyID != 0:
		return identity.NamespaceAPIKey, fmt.Sprintf("%d", u.ApiKeyID)
	case u.IsServiceAccount:
		return identity.NamespaceServiceAccount, fmt.Sprintf("%d", u.UserID)
	case u.UserID != 0:
		return identity.NamespaceUser, fmt.Sprintf("%d", u.UserID)
	case u.IsAnonymous:
		return identity.NamespaceAnonymous, ""
	case u.AuthenticatedBy == "render": //import cycle render
		return identity.NamespaceRenderService, fmt.Sprintf("%d", u.UserID)
	}

	// backwards compatibility
	return identity.NamespaceUser, fmt.Sprintf("%d", u.UserID)
}

// FIXME: remove this method once all services are using an interface
func (u *SignedInUser) IsNil() bool {
	return u == nil
}
