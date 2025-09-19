package example

import (
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/example/pkg/apis"
	exampleapp "github.com/grafana/grafana/apps/example/pkg/app"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*ExampleAppInstaller)(nil)
)

type ExampleAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) (*ExampleAppInstaller, error) {
	installer := &ExampleAppInstaller{
		cfg: cfg,
	}
	// Config specific to the app. This can pull from feature flags or setting.Cfg.
	// Here we don't do anything except set a static value for demonstration purposes.
	specificConfig := &exampleapp.ExampleConfig{
		EnableSomeFeature: true,
	}
	// Provider is the app provider, which contains the AppManifest, app-specific-config, and the New function for the app
	provider := simple.NewAppProvider(apis.LocalManifest(), specificConfig, exampleapp.New)

	// appConfig is used alongside the provider for registrion.
	// Most of the data is redunant, this may be more optimized in the future.
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	// NewDefaultInstaller gets us the installer we need to underly the ExampleAppInstaller type.
	// It does all the hard work of installing our app to the grafana API server
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}
