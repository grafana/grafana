//go:build wireinject && (enterprise || pro)
// +build wireinject
// +build enterprise pro

package server

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/api/routing"
	apiserverauditing "github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/grafana/grafana/pkg/bus"
	accesscontrolent "github.com/grafana/grafana/pkg/extensions/accesscontrol"
	"github.com/grafana/grafana/pkg/extensions/accesscontrol/acimpl"
	acdatabase "github.com/grafana/grafana/pkg/extensions/accesscontrol/database"
	"github.com/grafana/grafana/pkg/extensions/accesscontrol/iamrolessyncer"
	"github.com/grafana/grafana/pkg/extensions/accesscontrol/provisioner"
	"github.com/grafana/grafana/pkg/extensions/alertenrichment"
	"github.com/grafana/grafana/pkg/extensions/analytics"
	"github.com/grafana/grafana/pkg/extensions/analytics/datasources"
	datasourcesdatabase "github.com/grafana/grafana/pkg/extensions/analytics/datasources/database"
	"github.com/grafana/grafana/pkg/extensions/analytics/sortoptions"
	"github.com/grafana/grafana/pkg/extensions/analytics/summaries"
	summariesapi "github.com/grafana/grafana/pkg/extensions/analytics/summaries/api"
	summariesdatabase "github.com/grafana/grafana/pkg/extensions/analytics/summaries/database"
	"github.com/grafana/grafana/pkg/extensions/analytics/views"
	viewsapi "github.com/grafana/grafana/pkg/extensions/analytics/views/api"
	viewsdatabase "github.com/grafana/grafana/pkg/extensions/analytics/views/database"
	viewsservice "github.com/grafana/grafana/pkg/extensions/analytics/views/service"
	entanonvalidator "github.com/grafana/grafana/pkg/extensions/anonymous"
	extapiserver "github.com/grafana/grafana/pkg/extensions/apiserver"
	entapiserverauditing "github.com/grafana/grafana/pkg/extensions/apiserver/auditing"
	extapiregistry "github.com/grafana/grafana/pkg/extensions/apiserver/registry"
	"github.com/grafana/grafana/pkg/extensions/apiserver/registry/iam/externalgroupmapping"
	"github.com/grafana/grafana/pkg/extensions/apiserver/registry/iam/globalrole"
	"github.com/grafana/grafana/pkg/extensions/apiserver/registry/iam/role"
	"github.com/grafana/grafana/pkg/extensions/apiserver/registry/iam/rolebinding"
	teamlbacapi "github.com/grafana/grafana/pkg/extensions/apiserver/registry/iam/teamlbac"
	provisioningenterprise "github.com/grafana/grafana/pkg/extensions/apiserver/registry/provisioning"
	entsecret "github.com/grafana/grafana/pkg/extensions/apiserver/registry/secret"
	gsmEncryptionManager "github.com/grafana/grafana/pkg/extensions/apiserver/registry/secret/encryption"
	gsmKMSProviders "github.com/grafana/grafana/pkg/extensions/apiserver/registry/secret/kmsproviders"
	entsecretkeeper "github.com/grafana/grafana/pkg/extensions/apiserver/registry/secret/secretkeeper"
	usageinsightsAPIServer "github.com/grafana/grafana/pkg/extensions/apiserver/registry/usageinsights"
	"github.com/grafana/grafana/pkg/extensions/auditing"
	"github.com/grafana/grafana/pkg/extensions/auditlogprocessor"
	"github.com/grafana/grafana/pkg/extensions/auth"
	entidimpl "github.com/grafana/grafana/pkg/extensions/auth/idimpl"
	extauthn "github.com/grafana/grafana/pkg/extensions/authn"
	extauthz "github.com/grafana/grafana/pkg/extensions/authz"
	enterprisebackgroundservice "github.com/grafana/grafana/pkg/extensions/backgroundsvcs"
	"github.com/grafana/grafana/pkg/extensions/bannersettings"
	"github.com/grafana/grafana/pkg/extensions/billing"
	"github.com/grafana/grafana/pkg/extensions/caching"
	cachingstorage "github.com/grafana/grafana/pkg/extensions/caching/storage"
	"github.com/grafana/grafana/pkg/extensions/config/vault"
	"github.com/grafana/grafana/pkg/extensions/configprovider"
	guardian2 "github.com/grafana/grafana/pkg/extensions/dspermissions/guardian"
	aggregatorrunner "github.com/grafana/grafana/pkg/extensions/embeddedapiserver/aggregatorrunner"
	encryptionprovider "github.com/grafana/grafana/pkg/extensions/encryption"
	"github.com/grafana/grafana/pkg/extensions/enterprisepublicdashboards"
	"github.com/grafana/grafana/pkg/extensions/enterprisepublicdashboards/api"
	enterprisepublicdashboardsstore "github.com/grafana/grafana/pkg/extensions/enterprisepublicdashboards/database"
	enterprisepublicdashboardsmetric "github.com/grafana/grafana/pkg/extensions/enterprisepublicdashboards/metric"
	enterprisepublicdashboardsmiddleware "github.com/grafana/grafana/pkg/extensions/enterprisepublicdashboards/middleware"
	enterprisepublicdashboardsservice "github.com/grafana/grafana/pkg/extensions/enterprisepublicdashboards/service"
	"github.com/grafana/grafana/pkg/extensions/enterpriseusagestatssvcs"
	"github.com/grafana/grafana/pkg/extensions/groupsync"
	entkmsproviders "github.com/grafana/grafana/pkg/extensions/kmsproviders"
	"github.com/grafana/grafana/pkg/extensions/ldapdebug"
	"github.com/grafana/grafana/pkg/extensions/ldapsync"
	enterpriselicensing "github.com/grafana/grafana/pkg/extensions/licensing"
	licensingapi "github.com/grafana/grafana/pkg/extensions/licensing/api"
	licensingdatabase "github.com/grafana/grafana/pkg/extensions/licensing/database"
	"github.com/grafana/grafana/pkg/extensions/licensing/licensingtest"
	licensingservice "github.com/grafana/grafana/pkg/extensions/licensing/service"
	enterprisemigrations "github.com/grafana/grafana/pkg/extensions/migrations"
	"github.com/grafana/grafana/pkg/extensions/pluginsintegration"
	"github.com/grafana/grafana/pkg/extensions/provisioning/service"
	"github.com/grafana/grafana/pkg/extensions/ratelimiting"
	"github.com/grafana/grafana/pkg/extensions/recordedqueries"
	"github.com/grafana/grafana/pkg/extensions/remoteruler"
	"github.com/grafana/grafana/pkg/extensions/report"
	reportapi "github.com/grafana/grafana/pkg/extensions/report/api"
	"github.com/grafana/grafana/pkg/extensions/report/brandingstorage"
	reportdatabase "github.com/grafana/grafana/pkg/extensions/report/database"
	"github.com/grafana/grafana/pkg/extensions/report/render"
	"github.com/grafana/grafana/pkg/extensions/report/scheduler"
	"github.com/grafana/grafana/pkg/extensions/report/sender"
	reportservice "github.com/grafana/grafana/pkg/extensions/report/service"
	"github.com/grafana/grafana/pkg/extensions/requestinterceptor"
	"github.com/grafana/grafana/pkg/extensions/saml"
	"github.com/grafana/grafana/pkg/extensions/searchusers/filters"
	enterprisesearchusers "github.com/grafana/grafana/pkg/extensions/searchusers/manager"
	enterprisesecretsmigrator "github.com/grafana/grafana/pkg/extensions/secrets/migrator"
	extserver "github.com/grafana/grafana/pkg/extensions/server"
	"github.com/grafana/grafana/pkg/extensions/settings/settingsprovider"
	"github.com/grafana/grafana/pkg/extensions/storage/unified"
	"github.com/grafana/grafana/pkg/extensions/teamgroupsync"
	teamgroupsyncdatabase "github.com/grafana/grafana/pkg/extensions/teamgroupsync/database"
	"github.com/grafana/grafana/pkg/extensions/teamlbac"
	teamlbacservice "github.com/grafana/grafana/pkg/extensions/teamlbac/service"
	"github.com/grafana/grafana/pkg/extensions/usageinsights"
	"github.com/grafana/grafana/pkg/extensions/userprotection"
	"github.com/grafana/grafana/pkg/extensions/whitelabeling"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	ossexternalgroupmapping "github.com/grafana/grafana/pkg/registry/apis/iam/externalgroupmapping"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	osssecretkeeper "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	secretService "github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs"
	"github.com/grafana/grafana/pkg/registry/usagestatssvcs"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ossacimpl "github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl"
	"github.com/grafana/grafana/pkg/services/anonymous/validator"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	builder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	auth2 "github.com/grafana/grafana/pkg/services/auth"
	ossauth "github.com/grafana/grafana/pkg/services/auth/authimpl"
	"github.com/grafana/grafana/pkg/services/auth/idimpl"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl"
	"github.com/grafana/grafana/pkg/services/authz"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	osscaching "github.com/grafana/grafana/pkg/services/caching"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/services/encryption"
	ossencryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/searchusers"
	ossfilters "github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsDatabase "github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	secretsMigrator "github.com/grafana/grafana/pkg/services/secrets/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	ossunified "github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var provisioningExtras = wire.NewSet(
	provisioningenterprise.ProvideEnterpriseExtras,
	provisioningenterprise.ProvideEnterpriseConnectionExtras,
	provisioningenterprise.ProvideEnterpriseFactoryFromConfig,
)

var configProviderExtras = wire.NewSet(
	configprovider.ProvideService,
)

var wireExtsBasicSet = wire.NewSet(
	anonimpl.ProvideAnonymousDeviceService,
	wire.Bind(new(anonymous.Service), new(*anonimpl.AnonDeviceService)),
	entanonvalidator.ProvideEnterpriseAnonUserLimitValidator,
	wire.Bind(new(validator.AnonUserLimitValidator), new(*entanonvalidator.EnterpriseAnonUserLimitValidator)),
	licensingservice.ProvideLicenseTokenService,
	wire.Bind(new(enterpriselicensing.LicenseToken), new(*licensingservice.LicenseTokenService)),
	wire.Bind(new(enterpriselicensing.Licensing), new(*licensingservice.LicenseTokenService)),
	licensingservice.ProvideRenewalService,
	wire.Bind(new(enterpriselicensing.Renewal), new(*licensingservice.RenewalService)),
	licensingdatabase.ProvideStore,
	wire.Bind(new(enterpriselicensing.Store), new(*licensingdatabase.LicensingStore)),
	licensingapi.ProvideLicensingAPI,
	requestinterceptor.ProvideService,
	wire.Bind(new(validations.DataSourceRequestValidator), new(*requestinterceptor.RequestInterceptor)),
	requestinterceptor.ProvideURLValidator,
	wire.Bind(new(validations.DataSourceRequestURLValidator), new(*requestinterceptor.URLValidator)),
	settingsprovider.ProvideService,
	wire.Bind(new(setting.Provider), new(*settingsprovider.Implementation)),
	acdatabase.ProvideService,
	acimpl.ProvideService,
	iamrolessyncer.ProvideIAMRolesSyncer,
	wire.Bind(new(accesscontrol.Service), new(*acimpl.Service)),
	wire.Bind(new(accesscontrolent.Service), new(*acimpl.Service)),
	wire.Bind(new(accesscontrol.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(pluginaccesscontrol.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(accesscontrolent.PermissionValidator), new(*acimpl.Service)),
	wire.Bind(new(accesscontrolent.Store), new(*acdatabase.AccessControlStore)),
	wire.Bind(new(accesscontrolent.RoleMappingStore), new(*acdatabase.AccessControlStore)),
	provisioning.ProvideService,
	service.ProvideService,
	wire.Bind(new(provisioning.ProvisioningService), new(*service.EnterpriseProvisioningServiceImpl)),
	provisioner.ProvideService,
	analytics.ProvideService,
	enterprisepublicdashboardsmetric.ProvideService,
	wire.Bind(new(enterprisepublicdashboards.MetricService), new(*enterprisepublicdashboardsmetric.EnterprisePublicDashboardsMetricServiceImpl)),
	backgroundsvcs.ProvideBackgroundServiceRegistry,
	enterprisebackgroundservice.ProvideBackgroundServiceRegistry,
	wire.Bind(new(registry.BackgroundServiceRegistry), new(*enterprisebackgroundservice.BackgroundServiceRegistry)),
	usagestatssvcs.ProvideUsageStatsProvidersRegistry,
	enterpriseusagestatssvcs.ProvideUsageStatsProvidersRegistry,
	wire.Bind(new(registry.UsageStatsProvidersRegistry), new(*enterpriseusagestatssvcs.UsageStatsProvidersRegistry)),
	datasources.ProvideService,
	datasourcesdatabase.ProvideDatasourcesDatabase,
	summariesdatabase.ProvideSummariesDatabase,
	summariesapi.ProvideSummariesAPI,
	summaries.ProvideService,
	viewsservice.ProvideService,
	viewsapi.ProvideViewsAPI,
	viewsdatabase.ProvideViewsDatabase,
	wire.Bind(new(views.Store), new(*viewsdatabase.ViewsDatabase)),
	auditing.ProvideAuditing,
	sortoptions.ProvideSortOptions,
	vault.ProvideVaultKeyStore,
	whitelabeling.ProvideWhiteLabeling,
	teamgroupsync.ProvideTeamSync,
	teamgroupsyncdatabase.ProvideService,
	wire.Bind(new(teamgroupsyncdatabase.TeamSyncDatabase), new(*teamgroupsyncdatabase.Implementation)),

	// groupsync
	groupsync.ProvideGroupSync,
	groupsync.ProvideService,
	wire.Bind(new(groupsync.GroupSyncService), new(*groupsync.GroupSyncSvc)),
	groupsync.ProvideStore,
	wire.Bind(new(groupsync.GroupSyncStore), new(*groupsync.GroupSyncSQLStore)),
	groupsync.ProvideRBACService,
	wire.Bind(new(groupsync.GroupSyncRBACService), new(*groupsync.GroupSyncRBACSvc)),

	ldapdebug.ProvideDebug,
	wire.Bind(new(ldapdebug.TeamSyncInterface), new(*teamgroupsyncdatabase.Implementation)),
	wire.Bind(new(ldap.Groups), new(*ldapdebug.Debug)),
	ratelimiting.ProvideHTTPRateLimiting,
	billing.ProvideBilling,
	caching.ProvideService,
	wire.Bind(new(osscaching.CachingService), new(*caching.Service)),
	cachingstorage.ProvideStorage,
	saml.ProvideAuth,
	report.ProvideReport,
	ossauth.ProvideUserAuthTokenService,
	auth.ProvideService,
	wire.Bind(new(auditing.AuthTokenService), new(*auth.EnterpriseUserAuthTokenService)),
	wire.Bind(new(auth2.UserTokenService), new(*auth.EnterpriseUserAuthTokenService)),
	wire.Bind(new(saml.TokenCreator), new(*auth.EnterpriseUserAuthTokenService)),
	wire.Bind(new(ldapsync.BatchTokenRevoker), new(*auth.EnterpriseUserAuthTokenService)),
	wire.Bind(new(auth2.UserTokenBackgroundService), new(*auth.EnterpriseUserAuthTokenService)),
	ldapsync.ProvideLDAPSync,
	migrations.ProvideOSSMigrations,
	enterprisemigrations.ProvideEnterpriseMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*enterprisemigrations.EnterpriseMigrations)),
	userprotection.ProvideService,
	wire.Bind(new(login.UserProtectionService), new(*userprotection.UserProtectionService)),
	ossencryptionprovider.ProvideEncryptionProvider,
	encryptionprovider.ProvideEncryptionProvider,
	wire.Bind(new(encryption.Provider), new(encryptionprovider.Provider)),
	recordedqueries.ProvideService,
	remoteruler.ProvideService,
	searchusers.ProvideUsersService,
	enterprisesearchusers.ProvideEnterpriseService,
	wire.Bind(new(searchusers.Service), new(*enterprisesearchusers.EnterpriseService)),
	ossfilters.ProvideOSSSearchUserFilter,
	filters.ProvideEnterpriseSearchUserFilter,
	wire.Bind(new(user.SearchUserFilter), new(*filters.EnterpriseSearchUserFilter)),
	osskmsproviders.ProvideService,
	entkmsproviders.ProvideService,
	wire.Bind(new(kmsproviders.Service), new(*entkmsproviders.KeyProvidersService)),
	osssecretkeeper.ProvideService,
	entsecretkeeper.ProvideService,
	wire.Bind(new(contracts.KeeperService), new(*entsecretkeeper.EnterpriseKeeperService)),
	secretService.ProvideConsolidationService,
	entsecret.ProvideSecretsUINavTree,
	guardian2.ProvideGuardian,
	wire.Bind(new(guardian.DatasourceGuardianProvider), new(*guardian2.Provider)),
	reportdatabase.ProvideReportDatabase,
	wire.Bind(new(reportdatabase.Store), new(*reportdatabase.ReportDatabase)),
	render.ProvideRenderService,
	brandingstorage.ProvideBrandingStorage,
	sender.ProvideSenderService,
	wire.Bind(new(sender.Service), new(*sender.SenderService)),
	scheduler.ProvideScheduler,
	reportapi.ProvideReportAPI,
	reportservice.ProvideReportService,
	accesscontrolent.ProvideDatasourcePermissions,
	pluginsintegration.WireExtensionSet,
	enterprisepublicdashboardsmiddleware.ProvideEmailSharingMiddleware,
	wire.Bind(new(publicdashboards.Middleware), new(*enterprisepublicdashboardsmiddleware.PubdashEmailSharingMiddleware)),
	api.ProvideApi,
	enterprisepublicdashboardsservice.ProvideService,
	enterprisepublicdashboardsstore.ProvideStore,
	wire.Bind(new(enterprisepublicdashboards.Service), new(*enterprisepublicdashboardsservice.EnterprisePublicDashboardsServiceImpl)),
	wire.Bind(new(enterprisepublicdashboards.Store), new(*enterprisepublicdashboardsstore.EnterprisePublicDashboardStoreImpl)),
	publicdashboardsService.ProvideServiceWrapper,
	wire.Bind(new(publicdashboards.ServiceWrapper), new(*enterprisepublicdashboardsservice.PublicDashboardServiceWrapperImpl)),
	enterprisepublicdashboardsservice.ProvidePublicDashboardsServiceWrapper,
	wire.Bind(new(enterprisepublicdashboardsservice.EnterprisePublicDashboardsServiceWrapperImpl), new(*publicdashboardsService.PublicDashboardServiceWrapperImpl)),
	secretsMigrator.ProvideSecretsMigrator,
	enterprisesecretsmigrator.ProvideSecretsMigrator,
	wire.Bind(new(secrets.Migrator), new(*enterprisesecretsmigrator.SecretsMigrator)),
	entidimpl.ProvideSigner,
	wire.Bind(new(auth2.IDSigner), new(*entidimpl.ExternalSigner)),
	idimpl.ProvideLocalSigner,
	teamlbacservice.ProvideTeamLBACService,
	teamlbac.ProvideTeamLBAC,

	bannersettings.ProvideBannerSettings,

	usageinsightsAPIServer.ProvideLegacyDatabaseProvider,
	usageinsightsAPIServer.ProvideLegacySQLStores,
	usageinsightsAPIServer.ProvideStorage,
	usageinsights.ProvideSprinklesMetrics,
	usageinsights.ProvideService,
	search.ProvideDocumentBuilders,
	wire.Bind(new(builders.DashboardStats), new(*usageinsights.Service)),
	wire.Struct(new(ossunified.Options), "*"),
	unified.ProvideUnifiedStorageClient,
	unified.ProvideStorageBackend,
	builder.ProvideDefaultBuildHandlerChainFuncFromBuilders,
	aggregatorrunner.ProvideKubernetesAggregatorConfigurator,
	alertenrichment.ProvideService,

	// Provisioning
	entsecret.ProvideSecureValueClient,
	provisioningExtras,

	// IAM App storage backend override
	role.ProvideRoleApiInstaller,
	globalrole.ProvideGlobalRoleApiInstaller,
	teamlbacapi.ProvideTeamLBACApiInstaller,
	externalgroupmapping.ProvideExternalGroupMappingApiInstaller,
	rolebinding.ProvideStorageBackend,
	wire.Bind(new(iam.RoleBindingStorageBackend), new(*rolebinding.RoleBindingSqlBackend)),
	externalgroupmapping.ProvideStorageBackend,
	wire.Bind(new(iam.ExternalGroupMappingStorageBackend), new(*externalgroupmapping.ExternalGroupMappingSqlBackend)),
	externalgroupmapping.ProvideTeamGroupsREST,
	wire.Bind(new(ossexternalgroupmapping.TeamGroupsHandler), new(*externalgroupmapping.TeamGroupsREST)),
	externalgroupmapping.ProvideSearchREST,
	wire.Bind(new(ossexternalgroupmapping.SearchHandler), new(*externalgroupmapping.SearchREST)),

	// Grafana Secret Manager
	gsmKMSProviders.ProvideEnterpriseKMSProviders,
	gsmEncryptionManager.ProvideRedisDataKeyCache,

	configProviderExtras,

	// Auditing Options
	wire.Bind(new(apiserverauditing.Logger), new(*auditing.Auditing)),
	entapiserverauditing.ProvideGrafanaBackend,
	entapiserverauditing.UnionPolicyRuleProvider,

	// Zanzana store provider (enterprise overrides with gRPC datastore support)
	zStore.ProvideDefaultStoreProvider,
)

var wireExtsSet = wire.NewSet(
	wireSet,
	wire.Bind(new(licensing.Licensing), new(*licensingservice.LicenseTokenService)),
	wireExtsBasicSet,
	extapiregistry.WireSet, // K8s style apiservers
)

var wireExtsCLISet = wire.NewSet(
	wireCLISet,
	wire.Bind(new(licensing.Licensing), new(*licensingservice.LicenseTokenService)),
	wireExtsBasicSet,
	extapiregistry.WireSet, // K8s style apiservers
)

var wireExtsTestSet = wire.NewSet(
	wireTestSet,
	licensingtest.ProvideValidLicense,
	wire.Bind(new(licensing.Licensing), new(*licensingtest.ValidLicense)),
	wireExtsBasicSet,
	extapiregistry.TestWireSet, // K8s style apiservers
)

// The wireExtsBaseCLISet is a simplified set of dependencies for the enterprise
// CLI, suitable for running background services and targeted dskit modules
// without starting up the full Grafana server.
var wireExtsBaseCLISet = wire.NewSet(
	NewModuleRunner,
	// Core grafana infrastructure
	grafanaapiserver.ProvideDirectRestConfigProvider,
	metrics.WireSet,
	settingsprovider.ProvideService, wire.Bind(new(setting.Provider), new(*settingsprovider.Implementation)),
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,

	// storage and related bits
	sqlstore.ProvideService, wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
	migrations.ProvideOSSMigrations,
	enterprisemigrations.ProvideEnterpriseMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*enterprisemigrations.EnterpriseMigrations)),
	localcache.ProvideService,
	bus.ProvideBus, wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	tracing.ProvideService,
	tracing.ProvideTracingConfig,
	wire.Bind(new(tracing.Tracer), new(*tracing.TracingService)),
	kvstore.ProvideService,
	uss.ProvideService, wire.Bind(new(usagestats.Service), new(*uss.UsageStats)),
	serverlock.ProvideService,
	routing.ProvideRegister, wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),

	// legacy secrets, encryption, kms
	secretsManager.ProvideSecretsService, wire.Bind(new(secrets.Service), new(*secretsManager.SecretsService)),
	secretsDatabase.ProvideSecretsStore, wire.Bind(new(secrets.Store), new(*secretsDatabase.SecretsStoreImpl)),
	osskmsproviders.ProvideService,
	entkmsproviders.ProvideService, wire.Bind(new(kmsproviders.Service), new(*entkmsproviders.KeyProvidersService)),
	ossencryptionprovider.ProvideEncryptionProvider,
	encryptionprovider.ProvideEncryptionProvider, wire.Bind(new(encryption.Provider), new(encryptionprovider.Provider)),
	encryptionservice.ProvideEncryptionService, wire.Bind(new(encryption.Internal), new(*encryptionservice.Service)),

	// Public dashboards
	publicdashboardsStore.ProvideStore,
	wire.Bind(new(publicdashboards.Store), new(*publicdashboardsStore.PublicDashboardStoreImpl)),
	enterprisepublicdashboardsstore.ProvideStore,
	wire.Bind(new(enterprisepublicdashboards.Store), new(*enterprisepublicdashboardsstore.EnterprisePublicDashboardStoreImpl)),
	publicdashboardsService.ProvideServiceWrapper,
	enterprisepublicdashboardsservice.ProvidePublicDashboardsServiceWrapper,
	wire.Bind(new(publicdashboards.ServiceWrapper), new(*enterprisepublicdashboardsservice.PublicDashboardServiceWrapperImpl)),
	wire.Bind(new(enterprisepublicdashboardsservice.EnterprisePublicDashboardsServiceWrapperImpl), new(*publicdashboardsService.PublicDashboardServiceWrapperImpl)),

	// Access Control
	permreg.ProvidePermissionRegistry,
	resourcepermissions.NewActionSetService,
	wire.Bind(new(accesscontrol.ActionResolver), new(resourcepermissions.ActionSetService)),
	folderimpl.ProvideStore,
	wire.Bind(new(folder.Store), new(*folderimpl.FolderStoreImpl)),
	dashboardstore.ProvideDashboardStore,
	folderimpl.ProvideService,
	wire.Bind(new(folder.Service), new(*folderimpl.Service)),
	wire.Bind(new(folder.LegacyService), new(*folderimpl.Service)),
	tagimpl.ProvideService,
	wire.Bind(new(tag.Service), new(*tagimpl.Service)),
	acimpl.ProvideServiceForCLI,
	wire.Bind(new(accesscontrol.Service), new(*acimpl.Service)),
	wire.Bind(new(accesscontrolent.Service), new(*acimpl.Service)),
	wire.Bind(new(accesscontrolent.Store), new(*acdatabase.AccessControlStore)),
	ossacimpl.ProvideAccessControl, wire.Bind(new(accesscontrol.AccessControl), new(*ossacimpl.AccessControl)),
	acdatabase.ProvideService,
	authz.WireSet,
	zStore.ProvideDefaultStoreProvider,

	// Authn service and dependencies (required by access control)
	authnimpl.ProvideAuthnService,
	authnimpl.ProvideService,
	ossauth.ProvideUserAuthTokenService,
	auth.ProvideService,
	wire.Bind(new(auth2.UserTokenService), new(*auth.EnterpriseUserAuthTokenService)),
	authinfoimpl.ProvideService,
	wire.Bind(new(login.AuthInfoService), new(*authinfoimpl.Service)),
	authinfoimpl.ProvideStore,
	remotecache.ProvideService,
	wire.Bind(new(remotecache.CacheStorage), new(*remotecache.RemoteCache)),

	// licensing
	licensingservice.ProvideLicenseTokenService,
	licensing.ProvideService, wire.Bind(new(licensing.Licensing), new(*licensingservice.LicenseTokenService)),
	wire.Bind(new(enterpriselicensing.LicenseToken), new(*licensingservice.LicenseTokenService)),
	wire.Bind(new(enterpriselicensing.Licensing), new(*licensingservice.LicenseTokenService)),
	licensingservice.ProvideRenewalService, wire.Bind(new(enterpriselicensing.Renewal), new(*licensingservice.RenewalService)),
	licensingdatabase.ProvideStore, wire.Bind(new(enterpriselicensing.Store), new(*licensingdatabase.LicensingStore)),
	licensingapi.ProvideLicensingAPI,

	// the rest of the ~owl~ Grafana services
	userimpl.ProvideService,
	wire.Bind(new(user.Service), new(*userimpl.Service)),
	orgimpl.ProvideService,
	quotaimpl.ProvideService,
	teamimpl.ProvideService,
	wire.Bind(new(team.Service), new(*teamimpl.Service)),
	bundleregistry.ProvideService, wire.Bind(new(supportbundles.Service), new(*bundleregistry.Service)),
	configProviderExtras,
)

// wireModuleServerSet is a wire set for the ModuleServer.
var wireExtsModuleServerSet = wire.NewSet(
	NewModule,
	wireExtsBaseCLISet,
	// Unified storage
	resource.ProvideStorageMetrics,
	resource.ProvideIndexMetrics,

	// Enterprise modules
	extauthz.ProvideAuthZServer,
	extauthn.ProvideAuthnServer,
	auditlogprocessor.ProvideAuditLogProcessorServer,

	// White labeling
	whitelabeling.ProvideWhiteLabeling,
	hooks.ProvideService,

	extserver.ProvideEnterpriseModuleRegisterer,
	wire.Bind(new(ModuleRegisterer), new(*extserver.ModuleRegisterer)),
	unified.ProvideStorageBackend,
)

var wireExtsStandaloneAPIServerSet = wire.NewSet(
	extapiserver.ProvideAPIFactory,
)
