package bootstrap

import (
	"context"
	"path"
	"slices"

	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
)

// DefaultConstructor implements the default ConstructFunc used for the Construct step of the Bootstrap stage.
//
// It uses a pluginFactoryFunc to create plugins and the signatureCalculator to calculate the plugin's signature state.
type DefaultConstructor struct {
	pluginFactoryFunc   pluginFactoryFunc
	signatureCalculator plugins.SignatureCalculator
	log                 log.Logger
}

// DefaultConstructFunc is the default ConstructFunc used for the Construct step of the Bootstrap stage.
func DefaultConstructFunc(cfg *config.PluginManagementCfg, signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) ConstructFunc {
	return NewDefaultConstructor(cfg, signatureCalculator, assetPath).Construct
}

// DefaultDecorateFuncs are the default DecorateFuncs used for the Decorate step of the Bootstrap stage.
func DefaultDecorateFuncs(cfg *config.PluginManagementCfg) []DecorateFunc {
	return []DecorateFunc{
		AppDefaultNavURLDecorateFunc,
		TemplateDecorateFunc,
		AppChildDecorateFunc(),
		SkipHostEnvVarsDecorateFunc(cfg),
	}
}

// NewDefaultConstructor returns a new DefaultConstructor.
func NewDefaultConstructor(cfg *config.PluginManagementCfg, signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *DefaultConstructor {
	return &DefaultConstructor{
		pluginFactoryFunc:   NewDefaultPluginFactory(&cfg.Features, assetPath).createPlugin,
		signatureCalculator: signatureCalculator,
		log:                 log.New("plugins.construct"),
	}
}

// Construct will calculate the plugin's signature state and create the plugin using the pluginFactoryFunc.
func (c *DefaultConstructor) Construct(ctx context.Context, src plugins.PluginSource, bundle *plugins.FoundBundle) ([]*plugins.Plugin, error) {
	sig, err := c.signatureCalculator.Calculate(ctx, src, bundle.Primary)
	if err != nil {
		c.log.Warn("Could not calculate plugin signature state", "pluginId", bundle.Primary.JSONData.ID, "error", err)
		return nil, err
	}
	plugin, err := c.pluginFactoryFunc(bundle, src.PluginClass(ctx), sig)
	if err != nil {
		c.log.Error("Could not create primary plugin base", "pluginId", bundle.Primary.JSONData.ID, "error", err)
		return nil, err
	}
	res := make([]*plugins.Plugin, 0, len(plugin.Children)+1)
	res = append(res, plugin)
	res = append(res, plugin.Children...)
	return res, nil
}

// AppDefaultNavURLDecorateFunc is a DecorateFunc that sets the default nav URL for app plugins.
func AppDefaultNavURLDecorateFunc(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.IsApp() {
		setDefaultNavURL(p)
	}
	return p, nil
}

// TemplateDecorateFunc is a DecorateFunc that removes the placeholder for the version and last_update fields.
func TemplateDecorateFunc(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	// %VERSION% and %TODAY% are valid values, according to the plugin schema
	// but it's meant to be replaced by the build system with the actual version and date.
	// If not, it's the same than not having a version or a date.
	if p.Info.Version == "%VERSION%" {
		p.Info.Version = ""
	}

	if p.Info.Updated == "%TODAY%" {
		p.Info.Updated = ""
	}

	return p, nil
}

func setDefaultNavURL(p *plugins.Plugin) {
	// slugify pages
	for _, include := range p.Includes {
		if include.Slug == "" {
			include.Slug = slugify.Slugify(include.Name)
		}

		if !include.DefaultNav {
			continue
		}

		if include.Type == "page" {
			p.DefaultNavURL = path.Join("/plugins/", p.ID, "/page/", include.Slug)
		}
		if include.Type == "dashboard" {
			dboardURL := include.DashboardURLPath()
			if dboardURL == "" {
				p.Logger().Warn("Included dashboard is missing a UID field")
				continue
			}

			p.DefaultNavURL = dboardURL
		}
	}
}

// AppChildDecorateFunc is a DecorateFunc that configures child plugins of app plugins.
func AppChildDecorateFunc() DecorateFunc {
	return func(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
		if p.Parent != nil && p.Parent.IsApp() {
			configureAppChildPlugin(p.Parent, p)
		}
		return p, nil
	}
}

func configureAppChildPlugin(parent *plugins.Plugin, child *plugins.Plugin) {
	if !parent.IsApp() {
		return
	}
	child.IncludedInAppID = parent.ID

	// If the child plugin does not have a version, it will inherit the version from the parent.
	// This is to ensure that the frontend can appropriately cache the plugin assets.
	if child.Info.Version == "" {
		child.Info.Version = parent.Info.Version
	}
}

// SkipHostEnvVarsDecorateFunc returns a DecorateFunc that configures the SkipHostEnvVars field of the plugin.
// It will be set to true if the FlagPluginsSkipHostEnvVars feature flag is set, and the plugin is not present in the
// ForwardHostEnvVars plugin ids list.
func SkipHostEnvVarsDecorateFunc(cfg *config.PluginManagementCfg) DecorateFunc {
	return func(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
		p.SkipHostEnvVars = cfg.Features.SkipHostEnvVarsEnabled && !slices.Contains(cfg.ForwardHostEnvVars, p.ID)
		return p, nil
	}
}
