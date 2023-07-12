package bootstrap

import (
	"context"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/util"
)

type DefaultConstructor struct {
	pluginFactoryFunc   pluginFactoryFunc
	signatureCalculator plugins.SignatureCalculator
	assetPath           *assetpath.Service
	log                 log.Logger
}

var DefaultConstructFunc = func(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) ConstructFunc {
	return NewDefaultConstructor(signatureCalculator, assetPath).Bootstrap
}

var DefaultDecorateFuncs = []DecorateFunc{
	AliasDecorateFunc,
	AppDefaultNavURLDecorateFunc,
	AppChildDecorateFunc,
}

func NewDefaultConstructor(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *DefaultConstructor {
	f := NewDefaultPluginFactory(assetPath)
	return &DefaultConstructor{
		pluginFactoryFunc:   f.createPlugin,
		signatureCalculator: signatureCalculator,
		log:                 log.New("bootstrap"),
	}
}

func (c *DefaultConstructor) Bootstrap(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
	res := make([]*plugins.Plugin, 0, len(bundles))

	for _, bundle := range bundles {
		sig, err := c.signatureCalculator.Calculate(ctx, src, bundle.Primary)
		if err != nil {
			c.log.Warn("Could not calculate plugin signature state", "pluginID", bundle.Primary.JSONData.ID, "err", err)
			continue
		}
		plugin, err := c.pluginFactoryFunc(bundle.Primary, src.PluginClass(ctx), sig)
		if err != nil {
			c.log.Error("Could not create primary plugin base", "pluginID", bundle.Primary.JSONData.ID, "err", err)
			continue
		}
		res = append(res, plugin)

		children := make([]*plugins.Plugin, 0, len(bundle.Children))
		for _, child := range bundle.Children {
			cp, err := c.pluginFactoryFunc(*child, plugin.Class, sig)
			if err != nil {
				c.log.Error("Could not create child plugin base", "pluginID", child.JSONData.ID, "err", err)
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

// AliasDecorateFunc is a DecorateFunc that sets the alias for the plugin.
var AliasDecorateFunc = DecorateFunc(func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	switch p.ID {
	case "grafana-pyroscope-datasource": // rebranding
		p.Alias = "phlare"
	case "debug": // panel plugin used for testing
		p.Alias = "debugX"
	}
	return p, nil
})

// AppDefaultNavURLDecorateFunc is a DecorateFunc that sets the default nav URL for app plugins.
var AppDefaultNavURLDecorateFunc = DecorateFunc(func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.IsApp() {
		setDefaultNavURL(p)
	}
	return p, nil
})

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
var AppChildDecorateFunc = DecorateFunc(func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.Parent != nil && p.Parent.IsApp() {
		configureAppChildPlugin(p.Parent, p)
	}
	return p, nil
})

func configureAppChildPlugin(parent *plugins.Plugin, child *plugins.Plugin) {
	if !parent.IsApp() {
		return
	}
	appSubPath := strings.ReplaceAll(strings.Replace(child.FS.Base(), parent.FS.Base(), "", 1), "\\", "/")
	child.IncludedInAppID = parent.ID
	child.BaseURL = parent.BaseURL

	if parent.IsCorePlugin() {
		child.Module = util.JoinURLFragments("app/plugins/app/"+parent.ID, appSubPath) + "/module"
	} else {
		child.Module = util.JoinURLFragments("plugins/"+parent.ID, appSubPath) + "/module"
	}
}
