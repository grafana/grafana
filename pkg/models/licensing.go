package models

type Licensing interface {
	// HasValidLicense is true if a valid license exists
	HasValidLicense() bool

	// HasLicense is true if there is a license provided
	HasLicense() bool

	// Expiry returns the unix epoch timestamp when the license expires, or 0 if no valid license is provided
	Expiry() int64

	// Return edition
	Edition() string

	LicenseURL(user *SignedInUser) string

	StateInfo() string
}
