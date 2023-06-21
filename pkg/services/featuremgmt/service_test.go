package featuremgmt

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFeatureService(t *testing.T) {
	license := stubLicenseServier{
		flags: []FeatureFlag{
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

	// Enterprise features do not fall though automatically
	require.False(t, mgmt.IsEnabled("a.yes.default"))
	require.False(t, mgmt.IsEnabled("a.yes")) // licensed, but not enabled
}

var (
	_ licensing.Licensing = (*stubLicenseServier)(nil)
)

type stubLicenseServier struct {
	flags   []FeatureFlag
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

func (s stubLicenseServier) EnabledFeatures() map[string]bool {
	return map[string]bool{}
}

func (s stubLicenseServier) FeatureEnabled(feature string) bool {
	return s.enabled[feature]
}
