package gituisync

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/gituisync/pkg/apis"
	"github.com/grafana/grafana/apps/gituisync/pkg/apis/gituisync/v0alpha1"
	gituisyncapp "github.com/grafana/grafana/apps/gituisync/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
)

type GitUISyncAppProvider struct {
	app.Provider
}

func RegisterApp() *GitUISyncAppProvider {
	provider := &GitUISyncAppProvider{}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: v0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     gituisyncapp.GetKinds(),
		CustomConfig:     any(&gituisyncapp.GitUISyncConfig{}),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, gituisyncapp.New)
	return provider
}
