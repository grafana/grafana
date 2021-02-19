// swagger:route GET /api/v1/folder/{Id}/permissions folders RouteGetFolderPermissions
//
// sets an Alerting config
//
//     Responses:
//       200: Permissions
//       400: ValidationError

// swagger:route POST /api/v1/folder/{Id}/permissions folders RouteSetFolderPermissions
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

// swagger:parameters RouteGetFolderPermissions
type GetFolderPermsEndpointParams struct {
	// Id of a folder
	// in: path
	Id string
}

// swagger:parameters RouteSetFolderPermissions
type SetFolderPermsEndpointParams struct {
	// Id of a folder
	// in: path
	Id string

	// New folder permissions
	// in: body
	Body Permissions
}
