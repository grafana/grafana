package identity

import "github.com/grafana/grafana/pkg/models/roletype"

const (
	NamespaceUser           = "user"
	NamespaceAPIKey         = "api-key"
	NamespaceServiceAccount = "service-account"
	NamespaceAnonymous      = "anonymous"
	NamespaceRenderService  = "render"
)

type Requester interface {
	GetCacheKey() (string, error)
	GetIsGrafanaAdmin() bool
	GetLogin() string
	GetOrgID() int64
	GetPermissions() map[string][]string
	GetTeams() []int64
	GetOrgRole() roletype.RoleType
	GetNamespacedID() (string, string)
	IsNil() bool
}
