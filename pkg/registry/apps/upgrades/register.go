package upgrades

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/upgrades/pkg/apis"
	upgradesapp "github.com/grafana/grafana/apps/upgrades/pkg/apis/upgrades/app"
	upgradesv0alpha1 "github.com/grafana/grafana/apps/upgrades/pkg/apis/upgrades/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type UpgradesAppProvider struct {
	app.Provider
	cfg *setting.Cfg
}

func RegisterApp(
	cfg *setting.Cfg,
) *UpgradesAppProvider {
	provider := &UpgradesAppProvider{
		cfg: cfg,
	}
	grafanaVersion := cfg.SectionWithEnvOverrides("upgrades").Key("fake_version").MustString(cfg.BuildVersion)
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: upgradesv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     upgradesapp.GetKinds(),
		CustomConfig: any(&upgradesapp.UpgradesConfig{
			CurrentVersion: grafanaVersion,
		}),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, upgradesapp.New)
	return provider
}
