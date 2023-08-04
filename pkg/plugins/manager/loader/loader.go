package loader

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/oauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ plugins.ErrorResolver = (*Loader)(nil)

type Loader struct {
	discovery   discovery.Discoverer
	bootstrap   bootstrap.Bootstrapper
	initializer initialization.Initializer
	termination termination.Terminator

	processManager          process.Service
	pluginRegistry          registry.Service
	roleRegistry            plugins.RoleRegistry
	signatureValidator      signature.Validator
	externalServiceRegistry oauth.ExternalServiceRegistry
	assetPath               *assetpath.Service
	log                     log.Logger
	cfg                     *config.Cfg

	angularInspector angularinspector.Inspector

	errs map[string]*plugins.SignatureError
}

func ProvideService(cfg *config.Cfg, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service, roleRegistry plugins.RoleRegistry, assetPath *assetpath.Service,
	angularInspector angularinspector.Inspector, externalServiceRegistry oauth.ExternalServiceRegistry,
	discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, initializer initialization.Initializer,
	termination termination.Terminator) *Loader {
	return New(cfg, authorizer, pluginRegistry, process.NewManager(pluginRegistry), roleRegistry, assetPath,
		angularInspector, externalServiceRegistry, discovery, bootstrap, initializer, termination)
}

func New(cfg *config.Cfg, authorizer plugins.PluginLoaderAuthorizer, pluginRegistry registry.Service,
	processManager process.Service, roleRegistry plugins.RoleRegistry, assetPath *assetpath.Service,
	angularInspector angularinspector.Inspector, externalServiceRegistry oauth.ExternalServiceRegistry,
	discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, initializer initialization.Initializer,
	termination termination.Terminator) *Loader {
	return &Loader{
		pluginRegistry:          pluginRegistry,
		signatureValidator:      signature.NewValidator(authorizer),
		processManager:          processManager,
		errs:                    make(map[string]*plugins.SignatureError),
		log:                     log.New("plugin.loader"),
		roleRegistry:            roleRegistry,
		cfg:                     cfg,
		assetPath:               assetPath,
		angularInspector:        angularInspector,
		externalServiceRegistry: externalServiceRegistry,
		discovery:               discovery,
		bootstrap:               bootstrap,
		initializer:             initializer,
		termination:             termination,
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	// <DISCOVERY STAGE>
	discoveredPlugins, err := l.discovery.Discover(ctx, src)
	if err != nil {
		return nil, err
	}
	// </DISCOVERY STAGE>

	// <BOOTSTRAP STAGE>
	bootstrappedPlugins, err := l.bootstrap.Bootstrap(ctx, src, discoveredPlugins)
	if err != nil {
		return nil, err
	}
	// </BOOTSTRAP STAGE>

	// <VERIFICATION STAGE>
	verifiedPlugins := make([]*plugins.Plugin, 0, len(bootstrappedPlugins))
	for _, plugin := range bootstrappedPlugins {
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

		// verify module.js exists for SystemJS to load.
		// CDN plugins can be loaded with plugin.json only, so do not warn for those.
		if !plugin.IsRenderer() && !plugin.IsCorePlugin() {
			f, err := plugin.FS.Open("module.js")
			if err != nil {
				if errors.Is(err, plugins.ErrFileNotExist) {
					l.log.Warn("Plugin missing module.js", "pluginID", plugin.ID,
						"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.")
				}
			} else if f != nil {
				if err := f.Close(); err != nil {
					l.log.Warn("Could not close module.js", "pluginID", plugin.ID, "err", err)
				}
			}
		}

		// detect angular for external plugins
		if plugin.IsExternalPlugin() {
			var err error

			cctx, canc := context.WithTimeout(ctx, time.Second*10)
			plugin.AngularDetected, err = l.angularInspector.Inspect(cctx, plugin)
			canc()

			if err != nil {
				l.log.Warn("Could not inspect plugin for angular", "pluginID", plugin.ID, "err", err)
			}

			// Do not initialize plugins if they're using Angular and Angular support is disabled
			if plugin.AngularDetected && !l.cfg.AngularSupportEnabled {
				l.log.Error("Refusing to initialize plugin because it's using Angular, which has been disabled", "pluginID", plugin.ID)
				continue
			}
		}

		verifiedPlugins = append(verifiedPlugins, plugin)
	}
	// </VERIFICATION STAGE>

	// <INITIALIZATION STAGE>
	initializedPlugins, err := l.initializer.Initialize(ctx, verifiedPlugins)
	if err != nil {
		return nil, err
	}
	// </INITIALIZATION STAGE>

	// <POST-INITIALIZATION STAGE>
	for _, p := range initializedPlugins {
		if err = l.processManager.Start(ctx, p.ID); err != nil {
			l.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
			continue
		}

		if p.ExternalServiceRegistration != nil && l.cfg.Features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
			s, err := l.externalServiceRegistry.RegisterExternalService(ctx, p.ID, p.ExternalServiceRegistration)
			if err != nil {
				l.log.Error("Could not register an external service. Initialization skipped", "pluginID", p.ID, "err", err)
				continue
			}
			p.ExternalService = s
		}

		if err = l.roleRegistry.DeclarePluginRoles(ctx, p.ID, p.Name, p.Roles); err != nil {
			l.log.Warn("Declare plugin roles failed.", "pluginID", p.ID, "err", err)
		}

		if !p.IsCorePlugin() && !p.IsBundledPlugin() {
			metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))
		}
	}
	// </POST-INITIALIZATION STAGE>

	return initializedPlugins, nil
}

func (l *Loader) Unload(ctx context.Context, pluginID string) error {
	return l.termination.Terminate(ctx, pluginID)
}

func (l *Loader) PluginErrors() []*plugins.Error {
	errs := make([]*plugins.Error, 0, len(l.errs))
	for _, err := range l.errs {
		errs = append(errs, &plugins.Error{
			PluginID:  err.PluginID,
			ErrorCode: err.AsErrorCode(),
		})
	}

	return errs
}
