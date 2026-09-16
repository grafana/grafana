package rules

import (
	"testing"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/config"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestWatchNamespace(t *testing.T) {
	tests := []struct {
		name string
		cfg  *setting.Cfg
		want string
	}{
		{name: "nil cfg watches all namespaces", cfg: nil, want: ""},
		{name: "on-prem (no stack id) watches all namespaces", cfg: &setting.Cfg{}, want: ""},
		{name: "cloud scopes to the stack namespace", cfg: &setting.Cfg{StackID: "42"}, want: "stacks-42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, watchNamespace(tt.cfg))
		})
	}
}

func TestRegisterAppInstaller_UnifiedAlertingEnabled(t *testing.T) {
	tests := []struct {
		name            string
		enabled         bool
		expectInstaller bool
	}{
		{name: "unified_alerting disabled returns nil installer", enabled: false, expectInstaller: false},
		{name: "unified_alerting enabled returns installer", enabled: true, expectInstaller: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			enabled := tt.enabled
			cfg := &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{Enabled: &enabled}}
			ng := &ngalert.AlertNG{Cfg: cfg, Api: &api.API{AlertRules: &provisioning.AlertRuleService{}}}

			inst, err := RegisterAppInstaller(cfg, ng, nil, nil, nil)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.expectInstaller {
				require.NotNil(t, inst)
			} else {
				require.Nil(t, inst)
			}
		})
	}
}

func TestGetStorageOptions(t *testing.T) {
	a := &AppInstaller{}

	got := a.GetStorageOptions(config.ResourceInfo.GroupResource())
	require.False(t, got.EnableFolderSupport, "the Config singleton is a per-org object with no folder concept")

	got = a.GetStorageOptions(alertrule.ResourceInfo.GroupResource())
	require.True(t, got.EnableFolderSupport, "other rules-app kinds still live in folders")
}
