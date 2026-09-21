package errortracking

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	ActionEventsCreate = "errortracking.events:create"
	ActionEventsRead   = "errortracking.events:read"
)

var (
	eventsScope = accesscontrol.NewScopeProvider("errortracking.events")
)

// FixedRoleRegistrations provides tenant-scoped roles for the route resources.
// The API authorizer still enforces namespace equality before consulting these
// permissions, so a role never grants access to another tenant.
func FixedRoleRegistrations() []accesscontrol.RoleRegistration {
	return []accesscontrol.RoleRegistration{
		{
			Role: accesscontrol.RoleDTO{
				Name:        "fixed:errortracking.events:reader",
				DisplayName: "Error Tracking Event Reader",
				Description: "Read error-tracking events.",
				Group:       "Error Tracking",
				Permissions: []accesscontrol.Permission{{Action: ActionEventsRead, Scope: eventsScope.GetResourceAllScope()}},
			},
			Grants: []string{string(org.RoleViewer), string(org.RoleEditor), string(org.RoleAdmin)},
		},
		{
			Role: accesscontrol.RoleDTO{
				Name:        "fixed:errortracking.events:writer",
				DisplayName: "Error Tracking Event Writer",
				Description: "Create error-tracking events.",
				Group:       "Error Tracking",
				Permissions: []accesscontrol.Permission{
					{Action: ActionEventsCreate, Scope: eventsScope.GetResourceAllScope()},
					{Action: ActionEventsRead, Scope: eventsScope.GetResourceAllScope()},
				},
			},
			Grants: []string{string(org.RoleEditor), string(org.RoleAdmin)},
		},
	}
}
