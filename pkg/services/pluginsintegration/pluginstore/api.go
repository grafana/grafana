package pluginstore

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
)

type InstallsAPIRegistrar interface {
	Register(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error
}

type installsAPIRegistrar struct {
	featureToggles   featuremgmt.FeatureToggles
	clientGenerator  resource.ClientGenerator
	installRegistrar *install.InstallRegistrar
	orgService       org.Service
	namespaceMapper  request.NamespaceMapper
}

func ProvideAPIRegistrar(featureToggles featuremgmt.FeatureToggles, clientGenerator resource.ClientGenerator, orgService org.Service, cfgProvider configprovider.ConfigProvider) (InstallsAPIRegistrar, error) {
	return newInstallsAPIRegistrar(featureToggles, clientGenerator, orgService, cfgProvider)
}

func newInstallsAPIRegistrar(featureToggles featuremgmt.FeatureToggles, clientGenerator resource.ClientGenerator, orgService org.Service, cfgProvider configprovider.ConfigProvider) (*installsAPIRegistrar, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}
	namespaceMapper := request.GetNamespaceMapper(cfg)
	return &installsAPIRegistrar{
		clientGenerator:  clientGenerator,
		featureToggles:   featureToggles,
		installRegistrar: install.NewInstallRegistrar(clientGenerator),
		orgService:       orgService,
		namespaceMapper:  namespaceMapper,
	}, nil
}

func (a *installsAPIRegistrar) Register(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	if !a.featureToggles.IsEnabled(ctx, featuremgmt.FlagPluginInstallAPISync) {
		return nil
	}

	// the installs API is namespaced, so we need to register plugins for each org
	orgs, err := a.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, org := range orgs {
		ns := a.namespaceMapper(org.ID)
		err := a.registerPlugins(ctx, ns, source, installedPlugins)
		if err != nil {
			return err
		}
	}

	return nil
}

func (a *installsAPIRegistrar) registerPlugins(ctx context.Context, namespace string, source install.Source, installedPlugins []*plugins.Plugin) error {
	for _, p := range installedPlugins {
		err := a.installRegistrar.Register(ctx, namespace, &install.PluginInstall{
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
