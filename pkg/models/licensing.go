package models

type Licensing interface {
	HasValidLicense() bool
}

type OSSLicensingService struct{}

func (OSSLicensingService) Init() error {
	return nil
}

func (OSSLicensingService) HasValidLicense() bool {
	return false
}
