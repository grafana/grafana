package models

type Licensing interface {
	// HasValidLicense is true if a valid license exists
	HasValidLicense() bool

	// HasLicense is true if there is a license provided
	HasLicense() bool

	// Expiry returns the unix epoch timestamp when the license expires, or 0 if no valid license is provided
	Expiry() int64
}

type OSSLicensingService struct{}

func (OSSLicensingService) HasLicense() bool {
	return false
}

func (OSSLicensingService) Expiry() int64 {
	return 0
}

func (OSSLicensingService) Init() error {
	return nil
}

func (OSSLicensingService) HasValidLicense() bool {
	return false
}
