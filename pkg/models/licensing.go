package models

type Licensing interface {
	// Return edition
	Edition() string

	// Used to build content delivery URL
	ContentDeliveryPrefix() string

	LicenseURL(showAdminLicensingPage bool) string

	StateInfo() string

	EnabledFeatures() map[string]bool

	FeatureEnabled(feature string) bool
}

type LicenseEnvironment interface {
	// Environment is a map of environment variables
	Environment() map[string]string
}
