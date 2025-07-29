//go:build wireinject && oss
// +build wireinject,oss

// This file should contain wiresets which contain OSS-specific implementations.
package server

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/registry"
	apisregistry "github.com/grafana/grafana/pkg/registry/apis"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/extras"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	gsmKMSProviders "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs"
	"github.com/grafana/grafana/pkg/registry/usagestatssvcs"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl"
	"github.com/grafana/grafana/pkg/services/anonymous/validator"
	"github.com/grafana/grafana/pkg/services/apiserver/aggregatorrunner"
	builder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authimpl"
	"github.com/grafana/grafana/pkg/services/auth/idimpl"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/services/encryption"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/sandbox"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsApi "github.com/grafana/grafana/pkg/services/publicdashboards/api"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsMigrator "github.com/grafana/grafana/pkg/services/secrets/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	search2 "github.com/grafana/grafana/pkg/storage/unified/search"
)

var provisioningExtras = wire.NewSet(
	webhooks.ProvideWebhooks,
	extras.ProvideProvisioningOSSExtras,
)

var configProviderExtras = wire.NewSet(
	setting.ProvideService,
	wire.Bind(new(setting.SettingsProvider), new(*setting.OSSSettingsProvider)),
)

var wireExtsBasicSet = wire.NewSet(
	authimpl.ProvideUserAuthTokenService,
	wire.Bind(new(auth.UserTokenService), new(*authimpl.UserAuthTokenService)),
	wire.Bind(new(auth.UserTokenBackgroundService), new(*authimpl.UserAuthTokenService)),
	validator.ProvideAnonUserLimitValidator,
	wire.Bind(new(validator.AnonUserLimitValidator), new(*validator.AnonUserLimitValidatorImpl)),
	anonimpl.ProvideAnonymousDeviceService,
	wire.Bind(new(anonymous.Service), new(*anonimpl.AnonDeviceService)),
	licensing.ProvideService,
	wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
	setting.ProvideProvider,
	wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	acimpl.ProvideService,
	wire.Bind(new(accesscontrol.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(pluginaccesscontrol.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(accesscontrol.Service), new(*acimpl.Service)),
	validations.ProvideValidator,
	wire.Bind(new(validations.DataSourceRequestValidator), new(*validations.OSSDataSourceRequestValidator)),
	validations.ProvideURLValidator,
	wire.Bind(new(validations.DataSourceRequestURLValidator), new(*validations.OSSDataSourceRequestURLValidator)),
	provisioning.ProvideService,
	wire.Bind(new(provisioning.ProvisioningService), new(*provisioning.ProvisioningServiceImpl)),
	backgroundsvcs.ProvideBackgroundServiceRegistry,
	wire.Bind(new(registry.BackgroundServiceRegistry), new(*backgroundsvcs.BackgroundServiceRegistry)),
	migrations.ProvideOSSMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*migrations.OSSMigrations)),
	authinfoimpl.ProvideOSSUserProtectionService,
	wire.Bind(new(login.UserProtectionService), new(*authinfoimpl.OSSUserProtectionImpl)),
	encryptionprovider.ProvideEncryptionProvider,
	wire.Bind(new(encryption.Provider), new(encryptionprovider.Provider)),
	filters.ProvideOSSSearchUserFilter,
	wire.Bind(new(user.SearchUserFilter), new(*filters.OSSSearchUserFilter)),
	searchusers.ProvideUsersService,
	wire.Bind(new(searchusers.Service), new(*searchusers.OSSService)),
	osskmsproviders.ProvideService,
	wire.Bind(new(kmsproviders.Service), new(osskmsproviders.Service)),
	secretkeeper.ProvideService,
	wire.Bind(new(contracts.KeeperService), new(*secretkeeper.OSSKeeperService)),
	ldap.ProvideGroupsService,
	wire.Bind(new(ldap.Groups), new(*ldap.OSSGroups)),
	guardian.ProvideGuardian,
	wire.Bind(new(guardian.DatasourceGuardianProvider), new(*guardian.OSSProvider)),
	usagestatssvcs.ProvideUsageStatsProvidersRegistry,
	wire.Bind(new(registry.UsageStatsProvidersRegistry), new(*usagestatssvcs.UsageStatsProvidersRegistry)),
	ossaccesscontrol.ProvideDatasourcePermissionsService,
	wire.Bind(new(accesscontrol.DatasourcePermissionsService), new(*ossaccesscontrol.DatasourcePermissionsService)),
	pluginsintegration.WireExtensionSet,
	publicdashboardsApi.ProvideMiddleware,
	wire.Bind(new(publicdashboards.Middleware), new(*publicdashboardsApi.Middleware)),
	publicdashboardsService.ProvideServiceWrapper,
	wire.Bind(new(publicdashboards.ServiceWrapper), new(*publicdashboardsService.PublicDashboardServiceWrapperImpl)),
	caching.ProvideCachingService,
	wire.Bind(new(caching.CachingService), new(*caching.OSSCachingService)),
	secretsMigrator.ProvideSecretsMigrator,
	wire.Bind(new(secrets.Migrator), new(*secretsMigrator.SecretsMigrator)),
	idimpl.ProvideLocalSigner,
	wire.Bind(new(auth.IDSigner), new(*idimpl.LocalSigner)),
	manager.ProvideInstaller,
	wire.Bind(new(plugins.Installer), new(*manager.PluginInstaller)),
	search2.ProvideDashboardStats,
	wire.Bind(new(search2.DashboardStats), new(*search2.OssDashboardStats)),
	search2.ProvideDocumentBuilders,
	sandbox.ProvideService,
	wire.Bind(new(sandbox.Sandbox), new(*sandbox.Service)),
	wire.Struct(new(unified.Options), "*"),
	unified.ProvideUnifiedStorageClient,
	builder.ProvideDefaultBuildHandlerChainFuncFromBuilders,
	aggregatorrunner.ProvideNoopAggregatorConfigurator,
	apisregistry.WireSetExts,
	gsmKMSProviders.ProvideOSSKMSProviders,
	secret.ProvideSecureValueClient,
	provisioningExtras,
	configProviderExtras,
)

var wireExtsSet = wire.NewSet(
	wireSet,
	wireExtsBasicSet,
)

var wireExtsCLISet = wire.NewSet(
	wireCLISet,
	wireExtsBasicSet,
)

var wireExtsTestSet = wire.NewSet(
	wireTestSet,
	wireExtsBasicSet,
)

// The wireExtsBaseCLISet is a simplified set of dependencies for the OSS CLI,
// suitable for running background services and targeted dskit modules without
// starting up the full Grafana server.
var wireExtsBaseCLISet = wire.NewSet(
	NewModuleRunner,

	metrics.WireSet,
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	hooks.ProvideService,
	setting.ProvideProvider, wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	licensing.ProvideService, wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
)

// wireModuleServerSet is a wire set for the ModuleServer.
var wireExtsModuleServerSet = wire.NewSet(
	NewModule,
	wireExtsBaseCLISet,
	// Tracing
	tracing.ProvideTracingConfig,
	tracing.ProvideService,
	wire.Bind(new(tracing.Tracer), new(*tracing.TracingService)),
	// Unified storage
	resource.ProvideStorageMetrics,
	resource.ProvideIndexMetrics,
)

var wireExtsStandaloneAPIServerSet = wire.NewSet(
	standalone.ProvideAPIServerFactory,
)
