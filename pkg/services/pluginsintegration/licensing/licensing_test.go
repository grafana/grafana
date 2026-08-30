package licensing

import (
	"testing"

	servicelicensing "github.com/grafana/grafana/pkg/services/licensing"
	"github.com/stretchr/testify/require"
)

func TestServiceHasValidLicense(t *testing.T) {
	for _, tc := range []struct {
		name    string
		license servicelicensing.Licensing
		want    bool
	}{
		{
			name:    "delegates true",
			license: licenseWithValidity{valid: true},
			want:    true,
		},
		{
			name:    "delegates false",
			license: licenseWithValidity{valid: false},
			want:    false,
		},
		{
			name:    "unsupported OSS-like license",
			license: unsupportedLicense{},
			want:    false,
		},
		{
			name: "nil license",
			want: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := &Service{license: tc.license}
			require.Equal(t, tc.want, service.HasValidLicense())
		})
	}
}

type unsupportedLicense struct{}

func (unsupportedLicense) Expiry() int64 {
	return 0
}

func (unsupportedLicense) Edition() string {
	return "Open Source"
}

func (unsupportedLicense) ContentDeliveryPrefix() string {
	return "grafana-oss"
}

func (unsupportedLicense) LicenseURL(bool) string {
	return ""
}

func (unsupportedLicense) StateInfo() string {
	return ""
}

func (unsupportedLicense) EnabledFeatures() map[string]bool {
	return nil
}

func (unsupportedLicense) FeatureEnabled(string) bool {
	return false
}

type licenseWithValidity struct {
	unsupportedLicense
	valid bool
}

func (l licenseWithValidity) HasValidLicense() bool {
	return l.valid
}
