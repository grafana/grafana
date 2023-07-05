package stages

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

type Discoverer interface {
	Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error)
}

type Discovery struct {
	pluginFinder        finder.Finder
	pluginRegistry      registry.Service
	signatureCalculator plugins.SignatureCalculator
	assetPath           *assetpath.Service
	preCondition        PreLoadCondition
	log                 log.Logger
}

func NewDiscovery(pluginFinder finder.Finder, pluginRegistry registry.Service,
	signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *Discovery {
	return &Discovery{
		pluginFinder:        pluginFinder,
		pluginRegistry:      pluginRegistry,
		signatureCalculator: signatureCalculator,
		assetPath:           assetPath,
		preCondition: &DupePluginCheck{
			registry: pluginRegistry,
		},
		log: log.New("plugins.discovery"),
	}
}

func (d *Discovery) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	found, err := d.pluginFinder.Find(ctx, src)
	if err != nil {
		return nil, err
	}

	loadedPlugins := make([]*plugins.Plugin, 0, len(found))
	for _, p := range found {
		if res := d.preCondition.Check(ctx, p); !res.Proceed {
			d.log.Warn(res.Message, "pluginID", p.Primary.JSONData.ID)
			continue
		}

		sig, err := d.signatureCalculator.Calculate(ctx, src, p.Primary)
		if err != nil {
			d.log.Warn("Could not calculate plugin signature state", "pluginID", p.Primary.JSONData.ID, "err", err)
			continue
		}
		plugin, err := d.createPluginBase(p.Primary.JSONData, src.PluginClass(ctx), p.Primary.FS, sig)
		if err != nil {
			d.log.Error("Could not create primary plugin base", "pluginID", p.Primary.JSONData.ID, "err", err)
			continue
		}

		children := make([]*plugins.Plugin, 0, len(p.Children))
		for _, c := range p.Children {
			cp, err := d.createPluginBase(c.JSONData, plugin.Class, c.FS, sig)
			if err != nil {
				d.log.Error("Could not create child plugin base", "pluginID", p.Primary.JSONData.ID, "err", err)
				continue
			}
			cp.Parent = plugin
			plugin.Children = append(plugin.Children, cp)

			children = append(children, cp)
		}
		loadedPlugins = append(loadedPlugins, plugin)
		loadedPlugins = append(loadedPlugins, children...)
	}

	return loadedPlugins, err
}

func (d *Discovery) createPluginBase(pluginJSON plugins.JSONData, class plugins.Class, files plugins.FS,
	sig plugins.Signature) (*plugins.Plugin, error) {
	baseURL, err := d.assetPath.Base(pluginJSON, class, files.Base())
	if err != nil {
		return nil, fmt.Errorf("base url: %w", err)
	}
	moduleURL, err := d.assetPath.Module(pluginJSON, class, files.Base())
	if err != nil {
		return nil, fmt.Errorf("module url: %w", err)
	}
	plugin := &plugins.Plugin{
		JSONData:      pluginJSON,
		FS:            files,
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

type PreLoadCondition interface {
	// Check will return true if the plugin can be loaded, false otherwise.
	Check(ctx context.Context, bundle *plugins.FoundBundle) PreConditionResult
}

type PostLoadCondition interface {
	// Check will return true if the plugin can be loaded, false otherwise.
	Check(ctx context.Context, plugin *plugins.Plugin) PreConditionResult
}

type PreConditionResult struct {
	Proceed bool
	Message string
}

type DupePluginCheck struct {
	registry registry.Service
}

func (d *DupePluginCheck) Check(ctx context.Context, bundle *plugins.FoundBundle) PreConditionResult {
	_, exists := d.registry.Plugin(ctx, bundle.Primary.JSONData.ID)
	if exists {
		return PreConditionResult{
			Proceed: false,
			Message: "Skipping plugin loading as it's a duplicate",
		}
	}

	for _, child := range bundle.Children {
		_, exists = d.registry.Plugin(ctx, child.JSONData.ID)
		if exists {
			return PreConditionResult{
				Proceed: false,
				Message: "Skipping plugin loading as it's a duplicate",
			}
		}
	}

	return PreConditionResult{
		Proceed: true,
	}
}
