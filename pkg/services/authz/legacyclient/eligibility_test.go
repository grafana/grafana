package legacyclient_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type enforcementLicense struct {
	licensing.OSSLicensingService
	enabled bool
}

func (l *enforcementLicense) FeatureEnabled(feature string) bool {
	return feature == "accesscontrol.enforcement" && l.enabled
}

func TestRemoteEligible(t *testing.T) {
	for _, test := range []struct {
		name        string
		mode        string
		singleOrg   bool
		enforcement bool
		want        bool
	}{
		{name: "eligible", mode: "cloud", singleOrg: true, enforcement: true, want: true},
		{name: "default mode", singleOrg: true, enforcement: true},
		{name: "embedded mode", mode: "inproc", singleOrg: true, enforcement: true},
		{name: "unknown mode", mode: "other", singleOrg: true, enforcement: true},
		{name: "multiple organizations", mode: "cloud", enforcement: true},
		{name: "enforcement disabled", mode: "cloud", singleOrg: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			var err error
			cfg.Raw, err = ini.Load([]byte("[authorization]\nmode = " + test.mode))
			require.NoError(t, err)
			cfg.RBAC.SingleOrganization = test.singleOrg
			license := &enforcementLicense{enabled: test.enforcement}
			require.False(t, license.HasValidLicense())
			require.Equal(t, test.want, legacyclient.RemoteEligible(cfg, license))
		})
	}
}

func TestRemoteEligibleReadsCurrentEnforcement(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Raw.Section("authorization").Key("mode").SetValue("cloud")
	cfg.RBAC.SingleOrganization = true
	license := &enforcementLicense{}
	for _, enabled := range []bool{false, true, false} {
		license.enabled = enabled
		require.Equal(t, enabled, legacyclient.RemoteEligible(cfg, license))
	}
	require.False(t, legacyclient.RemoteEligible(cfg, &licensing.OSSLicensingService{}))
}

func TestRemoteEligibleUsesAuthorizationEnvironmentOverride(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Raw.Section("authorization").Key("mode").SetValue("inproc")
	cfg.RBAC.SingleOrganization = true
	license := &enforcementLicense{enabled: true}
	t.Setenv("GF_AUTHORIZATION_MODE", "cloud")
	require.True(t, legacyclient.RemoteEligible(cfg, license))
	t.Setenv("GF_AUTHORIZATION_MODE", "inproc")
	require.False(t, legacyclient.RemoteEligible(cfg, license))
}
