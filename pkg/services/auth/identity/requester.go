package identity

import "github.com/grafana/grafana/pkg/models/roletype"

type Requester interface {
	GetIsGrafanaAdmin() bool
	GetLogin() string
	GetOrgID() int64
	GetPermissions(orgID int64) map[string][]string
	GetTeams(orgID int64) []int64
	GetOrgRole(orgID int64) roletype.RoleType
	GetNamespacedID() (string, string)
	IsNil() bool
}
