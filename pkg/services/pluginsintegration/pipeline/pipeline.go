package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

func ProvideDiscoveryStage(cfg *config.PluginManagementCfg, pf finder.Finder, pr registry.Service) *discovery.Discovery {
	return discovery.New(cfg, discovery.Opts{
		FindFunc: pf.Find,
		FindFilterFuncs: []discovery.FindFilterFunc{
			discovery.NewPermittedPluginTypesFilterStep([]plugins.Type{
				plugins.TypeDataSource, plugins.TypeApp, plugins.TypePanel, plugins.TypeSecretsManager,
			}),
			func(ctx context.Context, _ plugins.Class, b []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return NewDuplicatePluginIDFilterStep(pr).Filter(ctx, b)
			},
			func(_ context.Context, _ plugins.Class, b []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return NewDisablePluginsStep(cfg).Filter(b)
			},
			func(_ context.Context, c plugins.Class, b []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return NewAsExternalStep(cfg).Filter(c, b)
			},
		},
	})
}

func ProvideBootstrapStage(cfg *config.PluginManagementCfg, sc plugins.SignatureCalculator, a *assetpath.Service) *bootstrap.Bootstrap {
	return bootstrap.New(cfg, bootstrap.Opts{
		ConstructFunc: bootstrap.DefaultConstructFunc(sc, a),
		DecorateFuncs: bootstrap.DefaultDecorateFuncs(cfg),
	})
}

func ProvideValidationStage(cfg *config.PluginManagementCfg, sv signature.Validator, ai angularinspector.Inspector) *validation.Validate {
	return validation.New(cfg, validation.Opts{
		ValidateFuncs: []validation.ValidateFunc{
			SignatureValidationStep(sv),
			validation.ModuleJSValidationStep(),
			validation.AngularDetectionStep(cfg, ai),
		},
	})
}

func ProvideInitializationStage(cfg *config.PluginManagementCfg, pr registry.Service, bp plugins.BackendFactoryProvider,
	pm process.Manager, externalServiceRegistry auth.ExternalServiceRegistry,
	roleRegistry pluginaccesscontrol.RoleRegistry,
	actionSetRegistry pluginaccesscontrol.ActionSetRegistry,
	pluginEnvProvider envvars.Provider,
	tracer tracing.Tracer) *initialization.Initialize {
	return initialization.New(cfg, initialization.Opts{
		InitializeFuncs: []initialization.InitializeFunc{
			ExternalServiceRegistrationStep(cfg, externalServiceRegistry, tracer),
			initialization.BackendClientInitStep(pluginEnvProvider, bp, tracer),
			initialization.BackendProcessStartStep(pm),
			RegisterPluginRolesStep(roleRegistry),
			RegisterActionSetsStep(actionSetRegistry),
			ReportBuildMetrics,
			ReportTargetMetrics,
			initialization.PluginRegistrationStep(pr),
		},
	})
}

func ProvideTerminationStage(cfg *config.PluginManagementCfg, pr registry.Service, pm process.Manager) (*termination.Terminate, error) {
	return termination.New(cfg, termination.Opts{
		TerminateFuncs: []termination.TerminateFunc{
			termination.BackendProcessTerminatorStep(pm),
			termination.DeregisterStep(pr),
		},
	})
}
