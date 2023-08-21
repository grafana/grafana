package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
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
	"github.com/grafana/grafana/pkg/plugins/oauth"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
)

func ProvideDiscoveryStage(cfg *config.Cfg, pf finder.Finder, pr registry.Service) *discovery.Discovery {
	return discovery.New(cfg, discovery.Opts{
		FindFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
			return pf.Find(ctx, src)
		},
		FindFilterFuncs: []discovery.FindFilterFunc{
			func(ctx context.Context, _ plugins.Class, b []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return discovery.NewDuplicatePluginFilterStep(pr).Filter(ctx, b)
			},
		},
	})
}

func ProvideBootstrapStage(cfg *config.Cfg, sc plugins.SignatureCalculator, a *assetpath.Service) *bootstrap.Bootstrap {
	return bootstrap.New(cfg, bootstrap.Opts{
		ConstructFunc: bootstrap.DefaultConstructFunc(sc, a),
		DecorateFuncs: bootstrap.DefaultDecorateFuncs,
	})
}

func ProvideValidationStage(cfg *config.Cfg, sv signature.Validator, ai angularinspector.Inspector,
	et pluginerrs.SignatureErrorTracker) *validation.Validate {
	return validation.New(cfg, validation.Opts{
		ValidateFuncs: []validation.ValidateFunc{
			SignatureValidationStep(sv, et),
			validation.ModuleJSValidationStep(),
			validation.AngularDetectionStep(cfg, ai),
		},
	})
}

func ProvideInitializationStage(cfg *config.Cfg, pr registry.Service, l plugins.Licensing,
	bp plugins.BackendFactoryProvider, pm process.Manager, externalServiceRegistry oauth.ExternalServiceRegistry,
	roleRegistry plugins.RoleRegistry) *initialization.Initialize {
	return initialization.New(cfg, initialization.Opts{
		InitializeFuncs: []initialization.InitializeFunc{
			initialization.BackendClientInitStep(envvars.NewProvider(cfg, l), bp),
			initialization.PluginRegistrationStep(pr),
			initialization.BackendProcessStartStep(pm),
			ExternalServiceRegistrationStep(cfg, externalServiceRegistry),
			RegisterPluginRolesStep(roleRegistry),
			ReportBuildMetrics,
		},
	})
}

func ProvideTerminationStage(cfg *config.Cfg, pr registry.Service, pm process.Manager) (*termination.Terminate, error) {
	return termination.New(cfg, termination.Opts{
		TerminateFuncs: []termination.TerminateFunc{
			termination.BackendProcessTerminatorStep(pm),
			termination.DeregisterStep(pr),
		},
	})
}
