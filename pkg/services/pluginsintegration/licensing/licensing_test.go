package licensing

import (
	"testing"

	servicelicensing "github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
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
			license: hostLicense(true),
			want:    true,
		},
		{
			name:    "delegates false",
			license: hostLicense(false),
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

func hostLicense(valid bool) *licensingtest.FakeLicensing {
	license := licensingtest.NewFakeLicensing()
	license.On("HasValidLicense").Return(valid)
	return license
}
