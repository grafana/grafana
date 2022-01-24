package featuremgmt

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestFeatureService(t *testing.T) {
	license := stubLicenseServier{
		flags: []models.FeatureFlag{
			{
				Name:            "a.yes.default",
				RequiresLicense: true,
				Expression:      "true",
			},
			{
				Name:            "a.yes",
				RequiresLicense: true,
				Expression:      "",
			},
			{
				Name:            "b.no",
				RequiresLicense: true,
			},
		},
		enabled: map[string]bool{
			"a.yes.default": true,
			"a.yes":         true,
		},
	}
	require.False(t, license.FeatureEnabled("unknown"))
	require.False(t, license.FeatureEnabled("b.no"))
	require.True(t, license.FeatureEnabled("a.yes"))
	require.True(t, license.FeatureEnabled("a.yes.default"))

	cfg := setting.NewCfg()
	mgmt, err := ProvideManagerService(cfg, license)
	require.NoError(t, err)
	require.NotNil(t, mgmt)

	require.True(t, mgmt.IsEnabled("a.yes.default"))
	require.False(t, mgmt.IsEnabled("a.yes")) // licensed, but not enabled
}

var (
	_ models.Licensing = (*stubLicenseServier)(nil)
)

type stubLicenseServier struct {
	flags   []models.FeatureFlag
	enabled map[string]bool
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

func (s stubLicenseServier) ListFeatures() []models.FeatureFlag {
	return s.flags
}

func (s stubLicenseServier) FeatureEnabled(feature string) bool {
	return s.enabled[feature]
}
