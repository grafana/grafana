package api

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
)

type SourceFactory struct {
	localSourceBuilder localSourceBuilder
	clientGenerator    resource.ClientGenerator
	cfgProvider        configprovider.ConfigProvider
	downloader         PluginDownloader
	startupCompleted   bool
}

func NewSourceFactory(localSourceBuilder localSourceBuilder, clientGenerator resource.ClientGenerator, cfgProvider configprovider.ConfigProvider, downloader PluginDownloader) *SourceFactory {
	return &SourceFactory{
		localSourceBuilder: localSourceBuilder,
		clientGenerator:    clientGenerator,
		cfgProvider:        cfgProvider,
		downloader:         downloader,
	}
}

func (f *SourceFactory) getClient() (*pluginsv0alpha1.PluginInstallClient, error) {
	return pluginsv0alpha1.NewPluginInstallClientFromGenerator(f.clientGenerator)
}

func (f *SourceFactory) fetchPluginInstalls(ctx context.Context) ([]install.PluginInstall, error) {
	client, err := f.getClient()
	if err != nil {
		return nil, err
	}
	list, err := client.ListAll(ctx, "default", resource.ListOptions{})
	if err != nil {
		return nil, err
	}
	pluginInstalls := make([]install.PluginInstall, 0, len(list.Items))
	for _, item := range list.Items {
		source := install.SourceUnknown
		if s, ok := item.Annotations[install.PluginInstallSourceAnnotation]; ok {
			source = install.Source(s)
		}
		pluginInstalls = append(pluginInstalls, install.PluginInstall{
			ID:      item.Spec.Id,
			Version: item.Spec.Version,
			URL:     item.Spec.Url,
			Class:   install.Class(item.Spec.Class),
			Source:  source,
		})
	}
	return pluginInstalls, nil
}

func (f *SourceFactory) List(ctx context.Context) ([]plugins.PluginSource, error) {
	pluginInstalls, err := f.fetchPluginInstalls(ctx)
	if err != nil {
		return nil, err
	}
	sources := make([]plugins.PluginSource, 0, len(pluginInstalls))
	if coreSource, err := f.buildCoreSource(pluginInstalls); err == nil {
		sources = append(sources, coreSource)
	}
	if externalSource, err := f.buildExternalSource(ctx, pluginInstalls); err == nil {
		sources = append(sources, externalSource)
	}
	return sources, nil
}

func (f *SourceFactory) buildCoreSource(installs []install.PluginInstall) (plugins.PluginSource, error) {
	corePaths := []string{}
	for _, i := range installs {
		if i.Class != install.ClassCore {
			continue
		}
		corePaths = append(corePaths, i.URL)
	}
	return f.localSourceBuilder(plugins.ClassCore, corePaths)
}

func (f *SourceFactory) buildExternalSource(ctx context.Context, installs []install.PluginInstall) (plugins.PluginSource, error) {
	cfg, err := f.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}
	cacheManager := NewCacheManager(cfg.PluginsPath)
	orchestrator := NewDownloadOrchestrator(f.downloader, cfg.PluginsPath, cfg.BuildVersion)
	versionResolver := NewVersionResolver(cacheManager, orchestrator)
	externalPaths := []string{}
	for _, i := range installs {
		if !f.startupCompleted && i.Source == install.SourcePreinstallAsync {
			continue
		}
		if i.Class != install.ClassExternal {
			continue
		}
		externalPaths = append(externalPaths, i.URL)
	}
	localSourceBuilder := func(class plugins.Class, paths []string) (plugins.PluginSource, error) {
		return f.localSourceBuilder(class, paths)
	}
	f.startupCompleted = true
	return NewDownloadSource(installs, cacheManager, orchestrator, versionResolver, localSourceBuilder), nil
}
