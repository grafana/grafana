package licensingtest

import (
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/licensing"
)

var _ licensing.Licensing = new(FakeLicensing)

func NewFakeLicensing() *FakeLicensing {
	return &FakeLicensing{&mock.Mock{}}
}

type FakeLicensing struct {
	*mock.Mock
}

func (f *FakeLicensing) Expiry() int64 {
	mockedArgs := f.Called()
	return mockedArgs.Get(0).(int64)
}

func (f *FakeLicensing) Edition() string {
	mockedArgs := f.Called()
	return mockedArgs.Get(0).(string)
}

func (f *FakeLicensing) ContentDeliveryPrefix() string {
	mockedArgs := f.Called()
	return mockedArgs.Get(0).(string)
}

func (f *FakeLicensing) LicenseURL(showAdminLicensingPage bool) string {
	mockedArgs := f.Called(showAdminLicensingPage)
	return mockedArgs.Get(0).(string)
}

func (f *FakeLicensing) StateInfo() string {
	mockedArgs := f.Called()
	return mockedArgs.Get(0).(string)
}

func (f *FakeLicensing) EnabledFeatures() map[string]bool {
	mockedArgs := f.Called()
	return mockedArgs.Get(0).(map[string]bool)
}

func (f *FakeLicensing) FeatureEnabled(feature string) bool {
	mockedArgs := f.Called(feature)
	return mockedArgs.Get(0).(bool)
}
