package featuremgmt

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestFeatureService(t *testing.T) {
	license := stubLicenseServier{
		flags: map[string]bool{
			"some.feature": true,
			"another":      true,
		},
	}
	cfg := setting.NewCfg()
	mgmt, err := ProvideManagerService(cfg, license)
	require.NoError(t, err)
	require.NotNil(t, mgmt)

	require.False(t, license.FeatureEnabled("test"))
	require.True(t, license.FeatureEnabled("some.feature"))
	require.True(t, mgmt.IsEnabled("some.feature"))
}

var (
	_ models.Licensing = (*stubLicenseServier)(nil)
)

type stubLicenseServier struct {
	flags map[string]bool
}

func (s stubLicenseServier) Expiry() int64 {
	return 100
}

func (s stubLicenseServier) Edition() string {
	return "test"
}

func (s stubLicenseServier) ContentDeliveryPrefix() string {
	return ""
}

func (s stubLicenseServier) LicenseURL(showAdminLicensingPage bool) string {
	return "http://??"
}

func (s stubLicenseServier) StateInfo() string {
	return "ok"
}

func (s stubLicenseServier) EnabledFeatures() map[string]bool {
	return s.flags
}

func (s stubLicenseServier) FeatureEnabled(feature string) bool {
	return s.flags[feature]
}
