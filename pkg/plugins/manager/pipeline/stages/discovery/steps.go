package discovery

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

type DuplicatePluginValidation struct {
	registry registry.Service
	log      log.Logger
}

func NewDuplicatePluginFilterStep(registry registry.Service) *DuplicatePluginValidation {
	return &DuplicatePluginValidation{
		registry: registry,
		log:      log.New("duplicate.checker"),
	}
}

func (d *DuplicatePluginValidation) Filter(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	res := make([]*plugins.FoundBundle, 0, len(bundles))
	for _, b := range bundles {
		_, exists := d.registry.Plugin(ctx, b.Primary.JSONData.ID)
		if exists {
			d.log.Warn("Skipping loading of plugin as it's a duplicate", "pluginID", b.Primary.JSONData.ID)
			continue
		}

		for _, child := range b.Children {
			_, exists = d.registry.Plugin(ctx, child.JSONData.ID)
			if exists {
				d.log.Warn("Skipping loading of child plugin as it's a duplicate", "pluginID", child.JSONData.ID)
				continue
			}
		}
		res = append(res, b)
	}

	return res, nil
}

type PluginFactoryFunc func(p plugins.FoundPlugin, pluginClass plugins.Class, sig plugins.Signature) (*plugins.Plugin, error)

type DefaultBootstrapper struct {
	pluginFactoryFunc   PluginFactoryFunc
	signatureCalculator plugins.SignatureCalculator
	log                 log.Logger
}

func NewDefaultBootstrapper(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *DefaultBootstrapper {
	f := NewDefaultPluginFactory(assetPath)
	return &DefaultBootstrapper{
		pluginFactoryFunc:   f.createPlugin,
		signatureCalculator: signatureCalculator,
		log:                 log.New("bootstrap"),
	}
}

func (b *DefaultBootstrapper) Bootstrap(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
	res := make([]*plugins.Plugin, 0, len(bundles))

	for _, bundle := range bundles {
		sig, err := b.signatureCalculator.Calculate(ctx, src, bundle.Primary)
		if err != nil {
			b.log.Warn("Could not calculate plugin signature state", "pluginID", bundle.Primary.JSONData.ID, "err", err)
			continue
		}
		plugin, err := b.pluginFactoryFunc(bundle.Primary, src.PluginClass(ctx), sig)
		if err != nil {
			b.log.Error("Could not create primary plugin base", "pluginID", bundle.Primary.JSONData.ID, "err", err)
			continue
		}
		res = append(res, plugin)

		children := make([]*plugins.Plugin, 0, len(bundle.Children))
		for _, c := range bundle.Children {
			cp, err := b.pluginFactoryFunc(*c, plugin.Class, sig)
			if err != nil {
				b.log.Error("Could not create child plugin base", "pluginID", c.JSONData.ID, "err", err)
				continue
			}
			cp.Parent = plugin
			plugin.Children = append(plugin.Children, cp)

			children = append(children, cp)
		}
		res = append(res, children...)
	}
	return res, nil
}

type DefaultPluginFactory struct {
	assetPath *assetpath.Service
}

func NewDefaultPluginFactory(assetPath *assetpath.Service) *DefaultPluginFactory {
	return &DefaultPluginFactory{assetPath: assetPath}
}

func (f *DefaultPluginFactory) createPlugin(p plugins.FoundPlugin, class plugins.Class,
	sig plugins.Signature) (*plugins.Plugin, error) {
	baseURL, err := f.assetPath.Base(p.JSONData, class, p.FS.Base())
	if err != nil {
		return nil, fmt.Errorf("base url: %w", err)
	}
	moduleURL, err := f.assetPath.Module(p.JSONData, class, p.FS.Base())
	if err != nil {
		return nil, fmt.Errorf("module url: %w", err)
	}

	plugin := &plugins.Plugin{
		JSONData:      p.JSONData,
		FS:            p.FS,
		BaseURL:       baseURL,
		Module:        moduleURL,
		Class:         class,
		Signature:     sig.Status,
		SignatureType: sig.Type,
		SignatureOrg:  sig.SigningOrg,
	}
	plugin.SetLogger(log.New(fmt.Sprintf("plugin.%s", plugin.ID)))

	return plugin, nil
}
