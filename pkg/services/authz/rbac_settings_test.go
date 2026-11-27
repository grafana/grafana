package authz

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestReadEmbeddedRBACServerSettingsForcePermissionRoleActionIndex(t *testing.T) {
	tests := []struct {
		name      string
		ini       string
		env       string
		wantForce bool
	}{
		{name: "default disabled", ini: "[authorization]\n"},
		{name: "enabled in ini", ini: "[authorization]\nforce_permission_role_action_index = true\n", wantForce: true},
		{name: "disabled in ini", ini: "[authorization]\nforce_permission_role_action_index = false\n"},
		{name: "environment overrides ini", ini: "[authorization]\nforce_permission_role_action_index = false\n", env: "true", wantForce: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.env != "" {
				t.Setenv("GF_AUTHORIZATION_FORCE_PERMISSION_ROLE_ACTION_INDEX", test.env)
			}

			cfg := setting.NewCfg()
			parsed, err := ini.Load([]byte(test.ini))
			require.NoError(t, err)
			cfg.Raw = parsed

			got := readEmbeddedRBACServerSettings(cfg)
			require.Equal(t, test.wantForce, got.ForcePermissionRoleActionIndex)
		})
	}
}

func TestReadAuthzClientSettingsGRPCClientOptions(t *testing.T) {
	const cloudBase = "[authorization]\nmode = cloud\nremote_address = authz:10000\n[grpc_client_authentication]\ntoken = t\ntoken_exchange_url = http://exchange\n"

	tests := []struct {
		name              string
		ini               string
		wantKeepalive     time.Duration
		wantKATimeout     time.Duration
		wantClientTimeout time.Duration
	}{
		{name: "defaults", ini: cloudBase, wantKATimeout: 10 * time.Second},
		{
			name:              "configured",
			ini:               cloudBase + "[authorization]\ngrpc_client_keepalive_time = 30s\ngrpc_client_keepalive_timeout = 5s\ngrpc_client_timeout = 2s\n",
			wantKeepalive:     30 * time.Second,
			wantKATimeout:     5 * time.Second,
			wantClientTimeout: 2 * time.Second,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			parsed, err := ini.Load([]byte(test.ini))
			require.NoError(t, err)
			cfg.Raw = parsed

			got, err := readAuthzClientSettings(cfg)
			require.NoError(t, err)
			require.Equal(t, test.wantKeepalive, got.grpcClientKeepaliveTime)
			require.Equal(t, test.wantKATimeout, got.grpcClientKeepaliveTimeout)
			require.Equal(t, test.wantClientTimeout, got.grpcClientTimeout)
		})
	}
}
