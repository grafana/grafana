package provider

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-app-sdk/simple"

	kindv1alpha1 "github.com/demo/manifest/pkg/generated/kind/v1alpha1"
	"github.com/demo/manifest/pkg/generated/manifestdata"
)

// New returns the app.Provider, the single entry point to this package. main.go uses it to read the
// manifest and instantiate the app.App.
func New() app.Provider {
	return simple.NewAppProvider(manifestdata.LocalManifest(), nil, newApp)
}

func newApp(cfg app.Config) (app.App, error) {
	clientGenerator := plugin.BuildClientGenerator(cfg.KubeConfig)
	kinds, err := kindv1alpha1.NewKindClientFromGenerator(clientGenerator)
	if err != nil {
		return nil, err
	}
	manifests := &manifestsHandler{kinds: kinds, ownerGroup: cfg.ManifestData.Group}

	return simple.NewApp(simple.AppConfig{
		Name:            "demo-manifest-app",
		ClientGenerator: clientGenerator,
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: kindv1alpha1.KindKind(),
			},
		},
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v1alpha1": {
				{Namespaced: false, Path: "_manifests", Method: simple.AppCustomRouteMethodGet}: manifests.serve,
			},
		},
	})
}
