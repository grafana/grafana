package strategies

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

const (
	radiusConfig = `[auth.radius]
enabled = true
server = 192.168.1.100
port = 1812
secret = mysecret
allow_sign_up = true
skip_org_role_sync = false
class_mappings = [{"class":"admin","orgId":1,"orgRole":"Admin","isGrafanaAdmin":true},{"class":"users","orgId":1,"orgRole":"Viewer","isGrafanaAdmin":false}]`
)

var (
	expectedRADIUSConfig = map[string]interface{}{
		"enabled":                true,
		"server":                 "192.168.1.100",
		"port":                   1812,
		"secretConfigured":       true,
		"allow_sign_up":          true,
		"skip_org_role_sync":     false,
		"class_mappings":         `[{"class":"admin","orgId":1,"orgRole":"Admin","isGrafanaAdmin":true},{"class":"users","orgId":1,"orgRole":"Viewer","isGrafanaAdmin":false}]`,
		"radius_timeout_seconds": 10,
	}

	expectedRADIUSConfigEmpty = map[string]interface{}{
		"enabled":                false,
		"server":                 "",
		"port":                   1812,
		"secretConfigured":       false,
		"allow_sign_up":          false,
		"skip_org_role_sync":     false,
		"class_mappings":         "",
		"radius_timeout_seconds": 10,
	}
)

func TestRADIUSStrategy_GetProviderConfig(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name           string
		iniContent     string
		want           map[string]interface{}
		wantErr        bool
		wantErrMessage string
	}{
		{
			name:       "should return the RADIUS config successfully",
			iniContent: radiusConfig,
			want:       expectedRADIUSConfig,
			wantErr:    false,
		},
		{
			name:       "should return empty config when no RADIUS section exists",
			iniContent: "",
			want:       expectedRADIUSConfigEmpty,
			wantErr:    false,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			iniFile, err := ini.Load([]byte(tc.iniContent))
			require.NoError(t, err)

			cfg := &setting.Cfg{
				Raw: iniFile,
			}

			strategy := NewRADIUSStrategy(cfg)
			actual, err := strategy.GetProviderConfig(context.Background(), "radius")

			if tc.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tc.wantErrMessage)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.want, actual)
		})
	}
}

func TestRADIUSStrategy_IsMatch(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		provider string
		want     bool
	}{
		{
			name:     "should return true for radius provider",
			provider: "radius",
			want:     true,
		},
		{
			name:     "should return false for ldap provider",
			provider: "ldap",
			want:     false,
		},
		{
			name:     "should return false for oauth provider",
			provider: "generic_oauth",
			want:     false,
		},
		{
			name:     "should return false for empty provider",
			provider: "",
			want:     false,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			strategy := NewRADIUSStrategy(&setting.Cfg{})
			actual := strategy.IsMatch(tc.provider)

			require.Equal(t, tc.want, actual)
		})
	}
}
