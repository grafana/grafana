package licensing

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ActionLicensingRead        = "licensing:read"
	ActionLicensingUpdate      = "licensing:update"
	ActionLicensingDelete      = "licensing:delete"
	ActionLicensingReportsRead = "licensing.reports:read"
)

// LicensingPageReaderAccess defines permissions that grant access to the licensing and stats page
var LicensingPageReaderAccess = accesscontrol.EvalAny(
	accesscontrol.EvalPermission(ActionLicensingRead),
	accesscontrol.EvalPermission(accesscontrol.ActionServerStatsRead),
)
