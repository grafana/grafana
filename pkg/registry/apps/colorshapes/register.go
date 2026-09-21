package colorshapes

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/colorshapes/pkg/apis/manifestdata"
	colorshapesapp "github.com/grafana/grafana/apps/colorshapes/pkg/app"
	colorshapesstorage "github.com/grafana/grafana/pkg/storage/colorshapes"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

// GetAuthorizer is required by pkg/services/apiserver/appinstaller: it panics if a
// registered API group's installer has no non-nil authorizer.
func (a AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return colorshapesapp.GetAuthorizer()
}

// RegisterAppInstaller wires the colorshapes app's SQL-backed store (which needs the
// shared db.DB, a main-module dependency the app's own go.mod intentionally doesn't
// carry — see apps/colorshapes/plan.md) into the app before installing it.
func RegisterAppInstaller(store *colorshapesstorage.Store) (*AppInstaller, error) {
	specificConfig := &colorshapesapp.Config{
		Store: store,
	}

	provider := simple.NewAppProvider(manifestdata.LocalManifest(), specificConfig, colorshapesapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}

	return &AppInstaller{AppInstaller: i}, nil
}
