package historian

import (
	"context"

	authtypes "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/alerting/apps/historian/pkg/apis"
	historianApp "github.com/grafana/alerting/apps/historian/pkg/app"
	historianAppConfig "github.com/grafana/alerting/apps/historian/pkg/app/config"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/appconfig"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	)
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
	accessClient authtypes.AccessClient,
) (*AppInstaller, error) {
	appSpecificConfig, err := appconfig.Historian(cfg, appconfig.Deps{AccessClient: accessClient})
	if err != nil {
		return nil, err
	}

	// If we're provided an AlertNG, then call back into that for things we need.
	// This is a temporary whilst building out the app; we should not depend on it.
	if ng != nil {
		if ng.IsDisabled() {
			log.New("app-registry").Info("Skipping Kubernetes Alerting Historian apiserver (historian.alerting.grafana.app): Unified Alerting is disabled")
			return nil, nil
		}

		handlers := &handlers{
			historian: ng.Api.Historian,
		}
		appSpecificConfig.GetAlertStateHistoryHandler = handlers.GetAlertStateHistoryHandler
	}

	return NewAppInstaller(appSpecificConfig)
}

func NewAppInstaller(appSpecificConfig historianAppConfig.RuntimeConfig) (*AppInstaller, error) {
	installer := &AppInstaller{}

	provider := simple.NewAppProvider(apis.LocalManifest(), appSpecificConfig, historianApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{},
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: appSpecificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
