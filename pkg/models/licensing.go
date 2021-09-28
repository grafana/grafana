package models

import "github.com/grafana/grafana/pkg/services/accesscontrol"

type Licensing interface {
	// HasValidLicense is true if a valid license exists
	HasValidLicense() bool

	// HasLicense is true if there is a license provided
	HasLicense() bool

	// Expiry returns the unix epoch timestamp when the license expires, or 0 if no valid license is provided
	Expiry() int64

	// Return edition
	Edition() string

	// Used to build content delivery URL
	ContentDeliveryPrefix() string

	LicenseURL(showAdminLicensingPage bool) string

	StateInfo() string
}

type LicenseEnvironment interface {
	// Environment is a map of environment variables
	Environment() map[string]string
}

const (
	// Licensing related actions
	ActionLicensingRead        = "licensing:read"
	ActionLicensingUpdate      = "licensing:update"
	ActionLicensingDelete      = "licensing:delete"
	ActionLicensingReportsRead = "licensing:reports:read"
)

// LicensingPageReaderAccess defines permissions that grant access to the licensing and stats page
var LicensingPageReaderAccess = accesscontrol.EvalAny(
		accesscontrol.EvalPermission(ActionLicensingRead),
		accesscontrol.EvalPermission(ActionLicensingReportsRead),
		accesscontrol.EvalPermission(accesscontrol.ActionServerStatsRead),
	)
