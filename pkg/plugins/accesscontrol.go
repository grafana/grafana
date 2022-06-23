package plugins

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ActionAppAccess = "plugins.app:access"
	ScopeAppAll     = "plugins.app:*"
)

var (
	ScopeProvider = accesscontrol.NewScopeProvider("plugins.app")
)

func DeclareRBACRoles(ac accesscontrol.AccessControl) error {
	// FIXME: come up with a proper name
	AppPluginReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "plugins.app:reader",
			DisplayName: "App Plugin Access",
			Description: "Grant access plugins (still enforcing the organization role)",
			Group:       "Plugins",
			Permissions: []accesscontrol.Permission{{Action: "plugins.app:access", Scope: "plugins.app:*"}},
		},
		Grants: []string{string(models.ROLE_VIEWER)},
	}
	return ac.DeclareFixedRoles(AppPluginReader)
}
