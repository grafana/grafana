// swagger:route GET /api/v1/namespace/{Namespace}/permissions permissions RouteGetNamespacePermissions
//
// sets an Alerting config
//
//     Responses:
//       200: Permissions
//       400: ValidationError

// swagger:route POST /api/v1/namespace/{Namespace}/permissions permissions RouteSetNamespacePermissions
//
// gets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError

package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
)

// swagger:model
type Permissions []dtos.UpdateDashboardAclCommand

// swagger:parameters RouteGetNamespacePermissions
type GetNamespacePermsEndpointParams struct {
	// Namespace name
	// in: path
	Namespace string
}

// swagger:parameters RouteSetNamespacePermissions
type SetNamespacePermsEndpointParams struct {
	// Namespace name to apply perms to
	// in: path
	Namespace string

	// New namespace permissions
	// in: body
	Body Permissions
}
