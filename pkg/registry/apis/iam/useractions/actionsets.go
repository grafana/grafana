package useractions

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
)

// NewActionSetResolver seeds a resolver with the resource permission action
// sets, so stored action sets can be expanded into the actions they stand for.
// Single-tenant gets this from the resource permission services registering
// themselves at startup; those services do not run in multi-tenant, so the same
// grants are seeded from the definitions they would have registered.
func NewActionSetResolver() accesscontrol.ActionResolver {
	svc := resourcepermissions.NewActionSetService()
	for name, actions := range map[string][]string{
		"dashboards:view":  ossaccesscontrol.DashboardViewActions,
		"dashboards:edit":  ossaccesscontrol.DashboardEditActions,
		"dashboards:admin": ossaccesscontrol.DashboardAdminActions,
		"folders:view":     append(ossaccesscontrol.DashboardViewActions, ossaccesscontrol.FolderViewActions...),
		"folders:edit":     append(ossaccesscontrol.DashboardEditActions, ossaccesscontrol.FolderEditActions...),
		"folders:admin":    append(ossaccesscontrol.DashboardAdminActions, ossaccesscontrol.FolderAdminActions...),
	} {
		svc.StoreActionSet(name, actions)
	}
	return svc
}
