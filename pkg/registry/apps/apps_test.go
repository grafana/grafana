package appregistry

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/historian"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/registry/apps/correlations"
	"github.com/grafana/grafana/pkg/registry/apps/dashvalidator"
	"github.com/grafana/grafana/pkg/registry/apps/example"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/plugins"
	"github.com/grafana/grafana/pkg/registry/apps/quotas"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideAppInstallers_Table(t *testing.T) {
	playlistInstaller := &playlist.AppInstaller{}
	pluginsInstaller := &plugins.AppInstaller{}
	rulesInstaller := &rules.AppInstaller{}
	correlationsAppInstaller := &correlations.AppInstaller{}
	notificationsAppInstaller := &notifications.AppInstaller{}
	annotationAppInstaller := &annotation.AppInstaller{}
	exampleAppInstaller := &example.AppInstaller{}
	advisorAppInstaller := &advisor.AppInstaller{}
	historianAppInstaller := &historian.AppInstaller{}
	quotasAppInstaller := &quotas.QuotasAppInstaller{}
	dashvalidatorAppInstaller := &dashvalidator.DashValidatorAppInstaller{}

	tests := []struct {
		name           string
		flags          []any
		rulesInst      *rules.AppInstaller
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
			cfg := &setting.Cfg{} // dummy cfg for test
			got := ProvideAppInstallers(features,
				cfg,
				playlistInstaller,
				pluginsInstaller,
				nil, // live
				nil, // ShortURL
				tt.rulesInst,
				correlationsAppInstaller,
				notificationsAppInstaller,
				nil,
				annotationAppInstaller,
				exampleAppInstaller,
				advisorAppInstaller,
				historianAppInstaller,
				quotasAppInstaller,
				dashvalidatorAppInstaller,
			)
			if tt.expectRulesApp {
				require.Contains(t, got, tt.rulesInst)
			} else {
				require.NotContains(t, got, tt.rulesInst)
			}
		})
	}
}
