package loader

import (
	"context"
	"errors"
	"fmt"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/hooks"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/util"
)

var _ plugins.ErrorResolver = (*Loader)(nil)

type Loader struct {
	pluginFinder        finder.Finder
	pluginRegistry      registry.Service
	signatureValidator  signature.Validator
	signatureCalculator plugins.SignatureCalculator
	assetPath           *assetpath.Service
	log                 log.Logger
	cfg                 *config.Cfg

	hooksRegistry hooks.Registry
	hooksRunner   hooks.Runner

	errs map[string]*plugins.SignatureError
}

func ProvideService(cfg *config.Cfg, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service, pluginFinder finder.Finder, assetPath *assetpath.Service,
	signatureCalculator plugins.SignatureCalculator, hooksRegistry hooks.Registry, hooksRunner hooks.Runner,

	// TODO: hooks: Provided just for hooks side-effects, find a better way
	pluginInitializer initializer.Initializer, _ process.Service,
) *Loader {
	return New(cfg, authorizer, pluginRegistry, assetPath, pluginFinder, signatureCalculator, pluginInitializer, hooksRegistry, hooksRunner)
}

func New(cfg *config.Cfg, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service,
	assetPath *assetpath.Service, pluginFinder finder.Finder, signatureCalculator plugins.SignatureCalculator,
	pluginInitializer initializer.Initializer,
	hooksRegistry hooks.Registry, hooksRunner hooks.Runner) *Loader {
	logger := log.New("plugin.loader")

	// TODO: hooks: Move those to separate services
	hooksRegistry.RegisterBeforeLoadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		if plugin.IsApp() {
			setDefaultNavURL(plugin)
		}
		return nil
	})
	hooksRegistry.RegisterBeforeLoadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		if plugin.Parent != nil && !plugin.Parent.IsApp() {
			configureAppChildPlugin(plugin.Parent, plugin)
		}
		return nil
	})

	// This hook MUST run AFTER all other before init hooks
	hooksRegistry.RegisterBeforeLoadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		if err := pluginInitializer.Initialize(ctx, plugin); err != nil {
			logger.Error("Could not initialize plugin", "pluginId", plugin.ID, "err", err)
		}
		return nil
	})

	hooksRegistry.RegisterLoadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		if !plugin.IsCorePlugin() && !plugin.IsBundledPlugin() {
			metrics.SetPluginBuildInformation(plugin.ID, string(plugin.Type), plugin.Info.Version, string(plugin.Signature))
		}
		return nil
	})
	hooksRegistry.RegisterLoadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		// verify module.js exists for SystemJS to load.
		// CDN plugins can be loaded with plugin.json only, so do not warn for those.
		if plugin.IsRenderer() || plugin.IsCorePlugin() {
			return nil
		}
		f, err := plugin.FS.Open("module.js")
		if err != nil {
			if errors.Is(err, plugins.ErrFileNotExist) {
				logger.Warn("Plugin missing module.js", "pluginID", plugin.ID,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.")
			}
		} else if f != nil {
			if err := f.Close(); err != nil {
				logger.Warn("Could not close module.js", "pluginID", plugin.ID, "err", err)
			}
		}
		return nil
	})
	hooksRegistry.RegisterLoadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		if !plugin.IsCorePlugin() {
			logger.Info("Plugin registered", "pluginID", plugin.ID)
		}
		return nil
	})

	hooksRegistry.RegisterUnloadHook(func(ctx context.Context, plugin *plugins.Plugin) error {
		if remover, ok := plugin.FS.(plugins.FSRemover); ok {
			return remover.Remove()
		}
		return nil
	})

	return &Loader{
		pluginFinder:        pluginFinder,
		pluginRegistry:      pluginRegistry,
		signatureValidator:  signature.NewValidator(authorizer),
		signatureCalculator: signatureCalculator,
		errs:                make(map[string]*plugins.SignatureError),
		log:                 logger,
		cfg:                 cfg,
		hooksRegistry:       hooksRegistry,
		hooksRunner:         hooksRunner,
		assetPath:           assetPath,
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	found, err := l.pluginFinder.Find(ctx, src)
	if err != nil {
		return nil, err
	}

	return l.loadPlugins(ctx, src, found)
}

func (l *Loader) loadPlugins(ctx context.Context, src plugins.PluginSource, found []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
	var loadedPlugins []*plugins.Plugin

	for _, p := range found {
		if _, exists := l.pluginRegistry.Plugin(ctx, p.Primary.JSONData.ID); exists {
			l.log.Warn("Skipping plugin loading as it's a duplicate", "pluginID", p.Primary.JSONData.ID)
			continue
		}

		sig, err := l.signatureCalculator.Calculate(ctx, src, p.Primary)
		if err != nil {
			l.log.Warn("Could not calculate plugin signature state", "pluginID", p.Primary.JSONData.ID, "err", err)
			continue
		}
		plugin, err := l.createPluginBase(p.Primary.JSONData, src.PluginClass(ctx), p.Primary.FS)
		if err != nil {
			l.log.Error("Could not create primary plugin base", "pluginID", p.Primary.JSONData.ID, "err", err)
			continue
		}

		plugin.Signature = sig.Status
		plugin.SignatureType = sig.Type
		plugin.SignatureOrg = sig.SigningOrg

		loadedPlugins = append(loadedPlugins, plugin)

		for _, c := range p.Children {
			if _, exists := l.pluginRegistry.Plugin(ctx, c.JSONData.ID); exists {
				l.log.Warn("Skipping plugin loading as it's a duplicate", "pluginID", p.Primary.JSONData.ID)
				continue
			}

			cp, err := l.createPluginBase(c.JSONData, plugin.Class, c.FS)
			if err != nil {
				l.log.Error("Could not create child plugin base", "pluginID", p.Primary.JSONData.ID, "err", err)
				continue
			}
			cp.Parent = plugin
			cp.Signature = sig.Status
			cp.SignatureType = sig.Type
			cp.SignatureOrg = sig.SigningOrg

			plugin.Children = append(plugin.Children, cp)

			loadedPlugins = append(loadedPlugins, cp)
		}
	}

	// validate signatures
	for _, plugin := range loadedPlugins {
		// TODO: hooks: implement as hook?
		signingError := l.signatureValidator.Validate(plugin)
		if signingError != nil {
			l.log.Warn("Skipping loading plugin due to problem with signature",
				"pluginID", plugin.ID, "status", signingError.SignatureStatus)
			plugin.SignatureError = signingError
			l.errs[plugin.ID] = signingError
			// skip plugin so it will not be loaded any further
			continue
		}

		// clear plugin error if a pre-existing error has since been resolved
		delete(l.errs, plugin.ID)
	}

	// Run before load hooks. If a before load hooks fail to run for a plugin, filter it out.
	verifiedPlugins := make([]*plugins.Plugin, 0, len(loadedPlugins))
	for _, p := range loadedPlugins {
		p := p
		err := l.hooksRunner.RunBeforeLoadHooks(ctx, p)
		if err != nil {
			l.log.Error("Error running before init hooks", "pluginId", p.ID, "err", err)
			continue
		}
		// An error in a before init hooks makes the plugin fail to load
		verifiedPlugins = append(verifiedPlugins, p)
	}

	// Run load hooks. If load hooks fail to run for a plugin, just log the failure.
	for _, p := range verifiedPlugins {
		if err := l.hooksRunner.RunLoadHooks(ctx, p); err != nil {
			l.log.Error("Error running after init hooks", "pluginId", p.ID, "err", err)
		}
	}
	return verifiedPlugins, nil
}

func (l *Loader) Unload(ctx context.Context, pluginID string) error {
	plugin, exists := l.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return plugins.ErrPluginNotInstalled
	}

	if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
		return plugins.ErrUninstallCorePlugin
	}

	if err := l.hooksRunner.RunUnloadHooks(ctx, plugin); err != nil {
		return err
	}

	l.log.Debug("Plugin unregistered", "pluginId", plugin.ID)
	return nil
}

func (l *Loader) createPluginBase(pluginJSON plugins.JSONData, class plugins.Class, files plugins.FS) (*plugins.Plugin, error) {
	baseURL, err := l.assetPath.Base(pluginJSON, class, files.Base())
	if err != nil {
		return nil, fmt.Errorf("base url: %w", err)
	}
	moduleURL, err := l.assetPath.Module(pluginJSON, class, files.Base())
	if err != nil {
		return nil, fmt.Errorf("module url: %w", err)
	}
	plugin := &plugins.Plugin{
		JSONData: pluginJSON,
		FS:       files,
		BaseURL:  baseURL,
		Module:   moduleURL,
		Class:    class,
	}

	plugin.SetLogger(log.New(fmt.Sprintf("plugin.%s", plugin.ID)))
	if err := l.setImages(plugin); err != nil {
		return nil, err
	}

	return plugin, nil
}

func (l *Loader) setImages(p *plugins.Plugin) error {
	var err error
	for _, dst := range []*string{&p.Info.Logos.Small, &p.Info.Logos.Large} {
		*dst, err = l.assetPath.RelativeURL(p, *dst, defaultLogoPath(p.Type))
		if err != nil {
			return fmt.Errorf("logo: %w", err)
		}
	}
	for i := 0; i < len(p.Info.Screenshots); i++ {
		screenshot := &p.Info.Screenshots[i]
		screenshot.Path, err = l.assetPath.RelativeURL(p, screenshot.Path, "")
		if err != nil {
			return fmt.Errorf("screenshot %d relative url: %w", i, err)
		}
	}
	return nil
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

func defaultLogoPath(pluginType plugins.Type) string {
	return "public/img/icn-" + string(pluginType) + ".svg"
}

func (l *Loader) PluginErrors() []*plugins.Error {
	errs := make([]*plugins.Error, 0)
	for _, err := range l.errs {
		errs = append(errs, &plugins.Error{
			PluginID:  err.PluginID,
			ErrorCode: err.AsErrorCode(),
		})
	}

	return errs
}
