package runner

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
)

type RunnerConfig struct {
	RestConfigGetter func(context.Context) (*rest.Config, error)
	APIRegistrar     builder.APIRegistrar
}

func NewAPIGroupRunner(cfg RunnerConfig, providers ...app.Provider) (*APIGroupRunner, error) {
	groups := []appBuilderGroup{}
	for _, provider := range providers {
		created, err := newAppBuilderGroup(cfg, provider)
		if err != nil {
			return nil, err
		}
		groups = append(groups, created)
	}
	return &APIGroupRunner{
		config:      cfg,
		groups:      groups,
		initialized: make(chan struct{}),
	}, nil
}

type APIGroupRunner struct {
	config      RunnerConfig
	groups      []appBuilderGroup
	initialized chan struct{}
}

func (r *APIGroupRunner) Run(ctx context.Context) error {
	<-r.initialized
	runner := app.NewMultiRunner()
	for _, g := range r.groups {
		runner.AddRunnable(g.app.Runner())
	}
	return runner.Run(ctx)
}

func (r *APIGroupRunner) Init(ctx context.Context) error {
	defer close(r.initialized)
	restConfig, err := r.config.RestConfigGetter(ctx)
	if err != nil {
		return err
	}
	for i := range r.groups {
		appConfig := app.Config{
			KubeConfig:     *restConfig,
			ManifestData:   *r.groups[i].provider.Manifest().ManifestData,
			SpecificConfig: r.groups[i].customConfig,
		}
		app, err := r.groups[i].provider.NewApp(appConfig)
		if err != nil {
			return err
		}
		r.groups[i].setApp(app)
	}
	return nil
}

func (r *APIGroupRunner) GetBuilders() []AppBuilder {
	builders := []AppBuilder{}
	for _, g := range r.groups {
		builders = append(builders, g.builders...)
	}
	return builders
}

type appBuilderGroup struct {
	builders     []AppBuilder
	provider     app.Provider
	app          app.App
	customConfig any
}

func newAppBuilderGroup(cfg RunnerConfig, provider app.Provider) (appBuilderGroup, error) {
	manifest := provider.Manifest()
	if manifest.Location.Type != app.ManifestLocationEmbedded {
		return appBuilderGroup{}, fmt.Errorf("app: %s has unsupported manifest location type: %s", manifest.ManifestData.AppName, manifest.Location.Type)
	}

	group := appBuilderGroup{
		provider: provider,
		builders: []AppBuilder{},
	}

	appBuilderConfig, ok := provider.SpecificConfig().(*AppBuilderConfig)
	if !ok {
		return group, fmt.Errorf("provider's SpecificConfig is not of type *AppBuilderConfig, got %T", provider.SpecificConfig())
	}

	for gv, kinds := range appBuilderConfig.ManagedKinds {
		confCopy := *appBuilderConfig
		confCopy.ManagedKinds = map[schema.GroupVersion][]resource.Kind{
			gv: kinds,
		}
		confCopy.groupVersion = gv
		if confCopy.CustomConfig != nil {
			group.customConfig = confCopy.CustomConfig
		}
		b, err := NewAppBuilder(confCopy)
		if err != nil {
			return group, err
		}
		group.builders = append(group.builders, b)
		cfg.APIRegistrar.RegisterAPI(b)
	}
	return group, nil
}

func (g *appBuilderGroup) setApp(app app.App) {
	g.app = app
	for _, b := range g.builders {
		b.SetApp(app)
	}
}
