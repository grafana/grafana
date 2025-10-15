package installsync

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
)

// Registrar is the interface for syncing plugin installations to the Kubernetes-style API.
type Registrar interface {
	Register(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error
}

type registrar struct {
	featureToggles   featuremgmt.FeatureToggles
	clientGenerator  resource.ClientGenerator
	installRegistrar *install.InstallRegistrar
	orgService       org.Service
	namespaceMapper  request.NamespaceMapper
	severLock        *serverlock.ServerLockService
}

// ProvideRegistrar creates a new Registrar for syncing plugin installations to the API.
func ProvideRegistrar(
	featureToggles featuremgmt.FeatureToggles,
	clientGenerator resource.ClientGenerator,
	orgService org.Service,
	cfgProvider configprovider.ConfigProvider,
	severLock *serverlock.ServerLockService,
) (Registrar, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}
	return &registrar{
		clientGenerator:  clientGenerator,
		featureToggles:   featureToggles,
		installRegistrar: install.NewInstallRegistrar(clientGenerator),
		orgService:       orgService,
		namespaceMapper:  request.GetNamespaceMapper(cfg),
		severLock:        severLock,
	}, nil
}

func (r *registrar) Register(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	if !r.featureToggles.IsEnabled(ctx, featuremgmt.FlagPluginInstallAPISync) {
		return nil
	}

	// the installs API is namespaced, so we need to register plugins for each org
	orgs, err := r.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, org := range orgs {
		ns := r.namespaceMapper(org.ID)
		err := r.registerPlugins(ctx, ns, source, installedPlugins)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *registrar) unregisterPlugins(ctx context.Context, namespace string, source install.Source, installedPlugins []*plugins.Plugin) error {
	for _, p := range installedPlugins {
		err := r.installRegistrar.Unregister(ctx, namespace, p.ID, source)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *registrar) registerPlugins(ctx context.Context, namespace string, source install.Source, installedPlugins []*plugins.Plugin) error {
	for _, p := range installedPlugins {
		err := r.installRegistrar.Register(ctx, namespace, &install.PluginInstall{
			ID:      p.ID,
			Version: p.Info.Version,
			Class:   install.Class(p.Class),
			Source:  source,
		})
		if err != nil {
			return err
		}
	}
	return nil
}
