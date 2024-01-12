package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	provider2 "github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	database2 "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	service4 "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/encryption/provider"
	service2 "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver/oasimpl"
	registry2 "github.com/grafana/grafana/pkg/services/extsvcauth/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetectorsprovider"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularinspector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/config"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keystore"
	licensing2 "github.com/grafana/grafana/pkg/services/pluginsintegration/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/loader"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
	service3 "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/serviceregistration"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	kvstore2 "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
	manager2 "github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeysimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	cloudmonitoring "github.com/grafana/grafana/pkg/tsdb/cloud-monitoring"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch"
	postgres "github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource"
	pyroscope "github.com/grafana/grafana/pkg/tsdb/grafana-pyroscope-datasource"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/tsdb/influxdb"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/opentsdb"
	"github.com/grafana/grafana/pkg/tsdb/parca"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
)

// This is a helper function to create a new datasource API server for a group
// This currently has no dependencies and only works for testdata.  In future iterations
// this will include here (or elsewhere) versions that can load config from HG api or
// the remote SQL directly
func NewStandaloneDatasource(group string) (*DataSourceAPIBuilder, error) {
	if group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("only testadata is currently supported")
	}
	pluginId := "grafana-testdata-datasource"

	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		// TODO: Add support for args?
	})
	if err != nil {
		return nil, err
	}

	routeRegisterImpl := routing.ProvideRegister()
	tracingService, err := tracing.ProvideService(cfg)
	if err != nil {
		return nil, err
	}
	inProcBus := bus.ProvideBus(tracingService)
	hooksService := hooks.ProvideService()
	ossLicensingService := licensing.ProvideService(cfg, hooksService)
	featureManager, err := featuremgmt.ProvideManagerService(cfg, ossLicensingService)
	if err != nil {
		return nil, err
	}
	ossMigrations := migrations.ProvideOSSMigrations()
	sqlStore, err := sqlstore.ProvideService(cfg, ossMigrations, inProcBus, tracingService)
	if err != nil {
		return nil, err
	}
	kvStore := kvstore.ProvideService(sqlStore)
	accessControl := acimpl.ProvideAccessControl(cfg)
	cacheService := localcache.ProvideService()
	featureToggles := featuremgmt.ProvideToggles(featureManager)
	acimplService, err := acimpl.ProvideService(cfg, sqlStore, routeRegisterImpl, cacheService, accessControl, featureToggles)
	if err != nil {
		return nil, err
	}
	bundleregistryService := bundleregistry.ProvideService()
	usageStats, err := service.ProvideService(cfg, kvStore, routeRegisterImpl, tracingService, accessControl, acimplService, bundleregistryService)
	if err != nil {
		return nil, err
	}
	secretsStoreImpl := database.ProvideSecretsStore(sqlStore)
	providerProvider := provider.ProvideEncryptionProvider()
	serviceService, err := service2.ProvideEncryptionService(providerProvider, usageStats, cfg)
	if err != nil {
		return nil, err
	}
	osskmsprovidersService := osskmsproviders.ProvideService(serviceService, cfg, featureToggles)
	secretsService, err := manager.ProvideSecretsService(secretsStoreImpl, osskmsprovidersService, serviceService, cfg, featureToggles, usageStats)
	if err != nil {
		return nil, err
	}
	remoteCache, err := remotecache.ProvideService(cfg, sqlStore, usageStats, secretsService)
	if err != nil {
		return nil, err
	}
	ossImpl := setting.ProvideProvider(cfg)
	configCfg, err := config.ProvideConfig(ossImpl, cfg, featureToggles)
	if err != nil {
		return nil, err
	}
	inMemory := registry.ProvideService()
	licensingService := licensing2.ProvideLicensing(cfg, ossLicensingService)
	ossPluginRequestValidator := validations.ProvideValidator()
	registerer := metrics.ProvideRegisterer(cfg)
	sourcesService := sources.ProvideService(cfg)
	local := finder.ProvideLocalFinder(configCfg)
	discovery := pipeline.ProvideDiscoveryStage(configCfg, local, inMemory)
	keystoreService := keystore.ProvideService(kvStore)
	keyRetriever := dynamic.ProvideService(cfg, keystoreService)
	keyretrieverService := keyretriever.ProvideService(keyRetriever)
	signatureSignature := signature.ProvideService(configCfg, keyretrieverService)
	pluginscdnService := pluginscdn.ProvideService(configCfg)
	assetpathService := assetpath.ProvideService(configCfg, pluginscdnService)
	bootstrap := pipeline.ProvideBootstrapStage(configCfg, signatureSignature, assetpathService)
	unsignedPluginAuthorizer := signature.ProvideOSSAuthorizer(configCfg)
	validation := signature.ProvideValidatorService(unsignedPluginAuthorizer)
	angularpatternsstoreService := angularpatternsstore.ProvideService(kvStore)
	angulardetectorsproviderDynamic, err := angulardetectorsprovider.ProvideDynamic(configCfg, angularpatternsstoreService, featureToggles)
	if err != nil {
		return nil, err
	}
	angularinspectorService, err := angularinspector.ProvideService(configCfg, angulardetectorsproviderDynamic)
	if err != nil {
		return nil, err
	}
	signatureErrorRegistry := pluginerrs.ProvideSignatureErrorTracker()
	validate := pipeline.ProvideValidationStage(configCfg, validation, angularinspectorService, signatureErrorRegistry)
	httpclientProvider := httpclientprovider.New(cfg, ossPluginRequestValidator, tracingService)
	azuremonitorService := azuremonitor.ProvideService(httpclientProvider)
	cloudWatchService := cloudwatch.ProvideService(cfg, httpclientProvider, featureToggles)
	cloudmonitoringService := cloudmonitoring.ProvideService(httpclientProvider, tracingService)
	elasticsearchService := elasticsearch.ProvideService(httpclientProvider, tracingService)
	graphiteService := graphite.ProvideService(httpclientProvider, tracingService)
	influxdbService := influxdb.ProvideService(httpclientProvider, featureToggles)
	lokiService := loki.ProvideService(httpclientProvider, featureToggles, tracingService)
	opentsdbService := opentsdb.ProvideService(httpclientProvider)
	prometheusService := prometheus.ProvideService(httpclientProvider, cfg, featureToggles)
	tempoService := tempo.ProvideService(httpclientProvider)
	testdatasourceService := testdatasource.ProvideService()
	postgresService := postgres.ProvideService(cfg)
	mysqlService := mysql.ProvideService(cfg, httpclientProvider)
	mssqlService := mssql.ProvideService(cfg)
	entityEventsService := store.ProvideEntityEventsService(cfg, sqlStore, featureToggles)
	quotaService := quotaimpl.ProvideService(sqlStore, cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	if err != nil {
		return nil, err
	}
	teamService := teamimpl.ProvideService(sqlStore, cfg)
	userService, err := userimpl.ProvideService(sqlStore, orgService, cfg, teamService, cacheService, quotaService, bundleregistryService)
	if err != nil {
		return nil, err
	}
	tagimplService := tagimpl.ProvideService(sqlStore)
	dashboardsStore, err := database2.ProvideDashboardStore(sqlStore, cfg, featureToggles, tagimplService, quotaService)
	if err != nil {
		return nil, err
	}
	dashboardFolderStoreImpl := folderimpl.ProvideDashboardFolderStore(sqlStore)
	folderService := folderimpl.ProvideService(accessControl, inProcBus, cfg, dashboardsStore, dashboardFolderStoreImpl, sqlStore, featureToggles, registerer)
	searchService := searchV2.ProvideService(cfg, sqlStore, entityEventsService, acimplService, tracingService, featureToggles, orgService, userService, folderService)
	systemUsers := store.ProvideSystemUsersService()
	storageService, err := store.ProvideService(sqlStore, featureToggles, cfg, quotaService, systemUsers)
	if err != nil {
		return nil, err
	}
	grafanadsService := grafanads.ProvideService(searchService, storageService)
	pyroscopeService := pyroscope.ProvideService(httpclientProvider)
	parcaService := parca.ProvideService(httpclientProvider)
	corepluginRegistry := coreplugin.ProvideCoreRegistry(tracingService, azuremonitorService, cloudWatchService, cloudmonitoringService, elasticsearchService, graphiteService, influxdbService, lokiService, opentsdbService, prometheusService, tempoService, testdatasourceService, postgresService, mysqlService, mssqlService, grafanadsService, pyroscopeService, parcaService)
	providerService := provider2.ProvideService(corepluginRegistry)
	processService := process.ProvideService()
	apikeyService, err := apikeyimpl.ProvideService(sqlStore, cfg, quotaService)
	if err != nil {
		return nil, err
	}
	serviceAccountsService, err := manager2.ProvideServiceAccountsService(cfg, usageStats, sqlStore, apikeyService, kvStore, userService, orgService, acimplService)
	if err != nil {
		return nil, err
	}
	extSvcAccountsService := extsvcaccounts.ProvideExtSvcAccountsService(acimplService, inProcBus, sqlStore, featureManager, registerer, serviceAccountsService, secretsService, tracingService)
	signingkeysimplService, err := signingkeysimpl.ProvideEmbeddedSigningKeysService(sqlStore, secretsService, remoteCache, routeRegisterImpl)
	if err != nil {
		return nil, err
	}
	oAuth2ServiceImpl, err := oasimpl.ProvideService(routeRegisterImpl, inProcBus, sqlStore, cfg, extSvcAccountsService, accessControl, acimplService, userService, teamService, signingkeysimplService, featureManager)
	if err != nil {
		return nil, err
	}
	serverLockService := serverlock.ProvideService(sqlStore, tracingService)
	registryRegistry := registry2.ProvideExtSvcRegistry(oAuth2ServiceImpl, extSvcAccountsService, serverLockService, featureToggles)
	service12 := service3.ProvideService(sqlStore, secretsService)
	serviceregistrationService := serviceregistration.ProvideService(configCfg, registryRegistry, service12)
	initialize := pipeline.ProvideInitializationStage(configCfg, inMemory, licensingService, providerService, processService, serviceregistrationService, acimplService)
	terminate, err := pipeline.ProvideTerminationStage(configCfg, inMemory, processService)
	if err != nil {
		return nil, err
	}
	loaderLoader := loader.ProvideService(discovery, bootstrap, validate, initialize, terminate)
	pluginstoreService, err := pluginstore.ProvideService(inMemory, sourcesService, loaderLoader)
	if err != nil {
		return nil, err
	}
	secretsKVStore, err := kvstore2.ProvideService(sqlStore, secretsService, pluginstoreService, kvStore, featureToggles, cfg)
	if err != nil {
		return nil, err
	}
	datasourcePermissionsService := ossaccesscontrol.ProvideDatasourcePermissionsService()
	service13, err := service4.ProvideService(sqlStore, secretsService, secretsKVStore, cfg, featureToggles, accessControl, datasourcePermissionsService, quotaService, pluginstoreService)
	if err != nil {
		return nil, err
	}
	ossProvider := guardian.ProvideGuardian()
	cacheServiceImpl := service4.ProvideCacheService(cacheService, sqlStore, ossProvider)

	testdataPlugin, found := pluginstoreService.Plugin(context.Background(), pluginId)
	if !found {
		return nil, fmt.Errorf("plugin %s not found", pluginId)
	}

	return NewDataSourceAPIBuilder(
		testdataPlugin.JSONData,
		testdatasource.ProvideService(),
		service13,
		cacheServiceImpl,
		accessControl,
	)
}
