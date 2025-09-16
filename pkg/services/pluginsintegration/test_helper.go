package pluginsintegration

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	pluginsCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/setting"
)

type IntegrationTestCtx struct {
	PluginClient   plugins.Client
	PluginStore    *pluginstore.Service
	PluginRegistry registry.Service
}

func CreateIntegrationTestCtx(t *testing.T, cfg *setting.Cfg, coreRegistry *coreplugin.Registry) *IntegrationTestCtx {
	pCfg, err := pluginconfig.ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
	require.NoError(t, err)

	cdn := pluginscdn.ProvideService(pCfg)
	reg := registry.ProvideService()
	angularInspector := angularinspector.NewStaticInspector()
	proc := process.ProvideService()

	disc := pipeline.ProvideDiscoveryStage(pCfg, reg)
	boot := pipeline.ProvideBootstrapStage(pCfg, signature.ProvideService(pCfg, statickey.New()), assetpath.ProvideService(pCfg, cdn, pluginassets.ProvideService()))
	valid := pipeline.ProvideValidationStage(pCfg, signature.NewValidator(signature.NewUnsignedAuthorizer(pCfg)), angularInspector)
	init := pipeline.ProvideInitializationStage(pCfg, reg, provider.ProvideService(coreRegistry), proc, &fakes.FakeAuthService{}, fakes.NewFakeRoleRegistry(), fakes.NewFakeActionSetRegistry(), nil, tracing.InitializeTracerForTest(), provisionedplugins.NewNoop())
	term, err := pipeline.ProvideTerminationStage(pCfg, reg, proc)
	require.NoError(t, err)

	l := CreateTestLoader(t, pCfg, LoaderOpts{
		Discoverer:   disc,
		Bootstrapper: boot,
		Validator:    valid,
		Initializer:  init,
		Terminator:   term,
	})

	ps, err := pluginstore.ProvideService(reg, sources.ProvideService(cfg, pCfg), l)
	require.NoError(t, err)

	return &IntegrationTestCtx{
		PluginClient:   client.ProvideService(reg),
		PluginStore:    ps,
		PluginRegistry: reg,
	}
}

type LoaderOpts struct {
	Discoverer   discovery.Discoverer
	Bootstrapper bootstrap.Bootstrapper
	Validator    validation.Validator
	Terminator   termination.Terminator
	Initializer  initialization.Initializer
}

func CreateTestLoader(t *testing.T, cfg *pluginsCfg.PluginManagementCfg, opts LoaderOpts) *loader.Loader {
	if opts.Discoverer == nil {
		opts.Discoverer = pipeline.ProvideDiscoveryStage(cfg, registry.ProvideService())
	}

	if opts.Bootstrapper == nil {
		opts.Bootstrapper = pipeline.ProvideBootstrapStage(cfg, signature.ProvideService(cfg, statickey.New()), assetpath.ProvideService(cfg, pluginscdn.ProvideService(cfg), pluginassets.ProvideService()))
	}

	if opts.Validator == nil {
		opts.Validator = pipeline.ProvideValidationStage(cfg, signature.NewValidator(signature.NewUnsignedAuthorizer(cfg)), angularinspector.NewStaticInspector())
	}

	if opts.Initializer == nil {
		reg := registry.ProvideService()
		coreRegistry := coreplugin.NewRegistry(make(map[string]backendplugin.PluginFactoryFunc))
		opts.Initializer = pipeline.ProvideInitializationStage(cfg, reg, provider.ProvideService(coreRegistry), process.ProvideService(), &fakes.FakeAuthService{}, fakes.NewFakeRoleRegistry(), fakes.NewFakeActionSetRegistry(), nil, tracing.InitializeTracerForTest(), provisionedplugins.NewNoop())
	}

	if opts.Terminator == nil {
		var err error
		reg := registry.ProvideService()
		opts.Terminator, err = pipeline.ProvideTerminationStage(cfg, reg, process.ProvideService())
		require.NoError(t, err)
	}

	return loader.New(cfg, opts.Discoverer, opts.Bootstrapper, opts.Validator, opts.Initializer, opts.Terminator, pluginerrs.ProvideErrorTracker())
}
