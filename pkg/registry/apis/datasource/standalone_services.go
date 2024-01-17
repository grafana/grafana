package datasource

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/plugins"
	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionService "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/config"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	kvstoreService "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/setting"
)

func apiBuilderServices(cfg *setting.Cfg, pluginID string) (
	*acimpl.AccessControl,
	*pluginstore.Service,
	*datasourceService.Service,
	*datasourceService.CacheServiceImpl,
	error,
) {
	accessControl := acimpl.ProvideAccessControl(cfg)
	cacheService := localcache.ProvideService()
	tracingService, err := tracing.ProvideService(cfg)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	routeRegisterImpl := routing.ProvideRegister()
	hooksService := hooks.ProvideService()
	ossLicensingService := licensing.ProvideService(cfg, hooksService)
	featureManager, err := featuremgmt.ProvideManagerService(cfg, ossLicensingService)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	inProcBus := bus.ProvideBus(tracingService)
	ossMigrations := migrations.ProvideOSSMigrations()
	sqlStore, err := sqlstore.ProvideService(cfg, ossMigrations, inProcBus, tracingService)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	kvStore := kvstore.ProvideService(sqlStore)
	featureToggles := featuremgmt.ProvideToggles(featureManager)
	acimplService, err := acimpl.ProvideService(cfg, sqlStore, routeRegisterImpl, cacheService, accessControl, featureToggles)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	bundleregistryService := bundleregistry.ProvideService()
	usageStats, err := service.ProvideService(cfg, kvStore, routeRegisterImpl, tracingService, accessControl, acimplService, bundleregistryService)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	secretsStoreImpl := database.ProvideSecretsStore(sqlStore)
	providerProvider := provider.ProvideEncryptionProvider()
	serviceService, err := encryptionService.ProvideEncryptionService(providerProvider, usageStats, cfg)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	osskmsprovidersService := osskmsproviders.ProvideService(serviceService, cfg, featureToggles)
	secretsService, err := manager.ProvideSecretsService(secretsStoreImpl, osskmsprovidersService, serviceService, cfg, featureToggles, usageStats)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	ossImpl := setting.ProvideProvider(cfg)
	configCfg, err := config.ProvideConfig(ossImpl, cfg, featureToggles)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	inMemory := registry.ProvideService()
	quotaService := quotaimpl.ProvideService(sqlStore, cfg)
	loaderLoader, err := createLoader(configCfg, inMemory)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	pluginstoreService, err := pluginstore.ProvideService(inMemory, newPluginSource(cfg, pluginID), loaderLoader)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	secretsKVStore, err := kvstoreService.ProvideService(sqlStore, secretsService, pluginstoreService, kvStore, featureToggles, cfg)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	datasourcePermissionsService := ossaccesscontrol.ProvideDatasourcePermissionsService()
	service13, err := datasourceService.ProvideService(sqlStore, secretsService, secretsKVStore, cfg, featureToggles, accessControl, datasourcePermissionsService, quotaService, pluginstoreService)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	ossProvider := guardian.ProvideGuardian()
	cacheServiceImpl := datasourceService.ProvideCacheService(cacheService, sqlStore, ossProvider)

	return accessControl, pluginstoreService, service13, cacheServiceImpl, nil
}

var _ sources.Registry = (*pluginSource)(nil)

type pluginSource struct {
	cfg      *setting.Cfg
	pluginID string
}

func newPluginSource(cfg *setting.Cfg, pluginID string) *pluginSource {
	return &pluginSource{
		cfg:      cfg,
		pluginID: pluginID,
	}
}

func (t *pluginSource) List(_ context.Context) []plugins.PluginSource {
	p := filepath.Join(t.cfg.StaticRootPath, "app/plugins/datasource", t.pluginID)
	return []plugins.PluginSource{sources.NewLocalSource(plugins.ClassCore, []string{p})}
}

func createLoader(cfg *pCfg.Cfg, pr registry.Service) (loader.Service, error) {
	d := discovery.New(cfg, discovery.Opts{
		FindFilterFuncs: []discovery.FindFilterFunc{
			func(ctx context.Context, _ plugins.Class, b []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return discovery.NewDuplicatePluginFilterStep(pr).Filter(ctx, b)
			},
		},
	})
	b := bootstrap.New(cfg, bootstrap.Opts{
		DecorateFuncs: []bootstrap.DecorateFunc{}, // no decoration required
	})
	v := validation.New(cfg, validation.Opts{
		ValidateFuncs: []validation.ValidateFunc{
			validation.SignatureValidationStep(signature.NewValidator(signature.NewUnsignedAuthorizer(cfg))),
		},
	})
	i := initialization.New(cfg, initialization.Opts{
		InitializeFuncs: []initialization.InitializeFunc{
			initialization.PluginRegistrationStep(pr),
		},
	})
	t, err := termination.New(cfg, termination.Opts{
		TerminateFuncs: []termination.TerminateFunc{
			termination.DeregisterStep(pr),
		},
	})
	if err != nil {
		return nil, err
	}

	return loader.New(d, b, v, i, t), nil
}
