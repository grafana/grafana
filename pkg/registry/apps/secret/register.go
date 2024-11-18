package secret

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	secretapis "github.com/grafana/grafana/apps/secret/pkg/apis"
	secretv0alpha1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v0alpha1"
	secretapp "github.com/grafana/grafana/apps/secret/pkg/app"

	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
)

type SecretAppProvider struct {
	app.Provider
}

func RegisterApp() *SecretAppProvider {
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: secretv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     secretapp.GetKinds(),
		CustomConfig: &secretapp.SecretConfig{
			EnableWatchers: true,
		},
	}

	return &SecretAppProvider{
		Provider: simple.NewAppProvider(secretapis.LocalManifest(), appCfg, secretapp.New),
	}
}
