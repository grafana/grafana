package models

type Licensing interface {
	// Expiry returns the unix epoch timestamp when the license expires, or 0 if no valid license is provided
	Expiry() int64

	// Return edition
	Edition() string

	// Used to build content delivery URL
	ContentDeliveryPrefix() string

	LicenseURL(showAdminLicensingPage bool) string

	StateInfo() string

	FeatureEnabled(feature string) bool
}

type LicenseEnvironment interface {
	// Environment is a map of environment variables
	Environment() map[string]string
}
