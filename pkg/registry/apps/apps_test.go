package appregistry

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/correlations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestProvideAppInstallers_Table(t *testing.T) {
	playlistInstaller := &playlist.PlaylistAppInstaller{}
	pluginsInstaller := &plugins.PluginsAppInstaller{}
	rulesInstaller := &rules.AlertingRulesAppInstaller{}
	correlationsAppInstaller := &correlations.CorrelationsAppInstaller{}
	notificationsAppInstaller := &notifications.AlertingNotificationsAppInstaller{}

	tests := []struct {
		name           string
		flags          []any
		rulesInst      *rules.AlertingRulesAppInstaller
		expectRulesApp bool
	}{
		{name: "no flags", flags: nil, rulesInst: nil, expectRulesApp: false},
		{name: "rules flag without installer", flags: []any{featuremgmt.FlagKubernetesAlertingRules}, rulesInst: nil, expectRulesApp: false},
		{name: "rules flag with installer", flags: []any{featuremgmt.FlagKubernetesAlertingRules}, rulesInst: rulesInstaller, expectRulesApp: true},
		{name: "rules installer without flag", flags: nil, rulesInst: rulesInstaller, expectRulesApp: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			features := featuremgmt.WithFeatures(tt.flags...)
			got := ProvideAppInstallers(features, playlistInstaller, pluginsInstaller, nil, tt.rulesInst, correlationsAppInstaller, notificationsAppInstaller, nil)
			if tt.expectRulesApp {
				require.Contains(t, got, tt.rulesInst)
			} else {
				require.NotContains(t, got, tt.rulesInst)
			}
		})
	}
}
