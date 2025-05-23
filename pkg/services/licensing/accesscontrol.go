package licensing

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ActionRead        = "licensing:read"
	ActionWrite       = "licensing:write"
	ActionDelete      = "licensing:delete"
	ActionReportsRead = "licensing.reports:read"
)

// PageAccess defines permissions that grant access to the licensing and stats page
var PageAccess = accesscontrol.EvalAny(
	accesscontrol.EvalPermission(ActionRead),
	accesscontrol.EvalPermission(accesscontrol.ActionServerStatsRead),
)
