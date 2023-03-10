//go:build wireinject && oss
// +build wireinject,oss

package server

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/server/usagestatssvcs"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authimpl"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/permissions"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/encryption"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/thumbs"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

var wireExtsBasicSet = wire.NewSet(
	authimpl.ProvideUserAuthTokenService,
	wire.Bind(new(auth.UserTokenService), new(*authimpl.UserAuthTokenService)),
	wire.Bind(new(auth.UserTokenBackgroundService), new(*authimpl.UserAuthTokenService)),
	anonimpl.ProvideAnonymousSessionService,
	wire.Bind(new(anonymous.Service), new(*anonimpl.AnonSessionService)),
	licensing.ProvideService,
	wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
	setting.ProvideProvider,
	wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	acimpl.ProvideService,
	wire.Bind(new(accesscontrol.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(plugins.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(accesscontrol.Service), new(*acimpl.Service)),
	thumbs.ProvideCrawlerAuthSetupService,
	wire.Bind(new(thumbs.CrawlerAuthSetupService), new(*thumbs.OSSCrawlerAuthSetupService)),
	validations.ProvideValidator,
	wire.Bind(new(validations.PluginRequestValidator), new(*validations.OSSPluginRequestValidator)),
	provisioning.ProvideService,
	wire.Bind(new(provisioning.ProvisioningService), new(*provisioning.ProvisioningServiceImpl)),
	backgroundsvcs.ProvideBackgroundServiceRegistry,
	wire.Bind(new(registry.BackgroundServiceRegistry), new(*backgroundsvcs.BackgroundServiceRegistry)),
	datasourceservice.ProvideCacheService,
	wire.Bind(new(datasources.CacheService), new(*datasourceservice.CacheServiceImpl)),
	migrations.ProvideOSSMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*migrations.OSSMigrations)),
	authinfoservice.ProvideOSSUserProtectionService,
	wire.Bind(new(login.UserProtectionService), new(*authinfoservice.OSSUserProtectionImpl)),
	encryptionprovider.ProvideEncryptionProvider,
	wire.Bind(new(encryption.Provider), new(encryptionprovider.Provider)),
	filters.ProvideOSSSearchUserFilter,
	wire.Bind(new(user.SearchUserFilter), new(*filters.OSSSearchUserFilter)),
	searchusers.ProvideUsersService,
	wire.Bind(new(searchusers.Service), new(*searchusers.OSSService)),
	osskmsproviders.ProvideService,
	wire.Bind(new(kmsproviders.Service), new(osskmsproviders.Service)),
	ldap.ProvideGroupsService,
	wire.Bind(new(ldap.Groups), new(*ldap.OSSGroups)),
	permissions.ProvideDatasourcePermissionsService,
	wire.Bind(new(permissions.DatasourcePermissionsService), new(*permissions.OSSDatasourcePermissionsService)),
	usagestatssvcs.ProvideUsageStatsProvidersRegistry,
	wire.Bind(new(registry.UsageStatsProvidersRegistry), new(*usagestatssvcs.UsageStatsProvidersRegistry)),
	ossaccesscontrol.ProvideDatasourcePermissionsService,
	wire.Bind(new(accesscontrol.DatasourcePermissionsService), new(*ossaccesscontrol.DatasourcePermissionsService)),
	pluginsintegration.WireExtensionSet,
	publicdashboardsService.ProvideServiceWrapper,
	wire.Bind(new(publicdashboards.ServiceWrapper), new(*publicdashboardsService.PublicDashboardServiceWrapperImpl)),
	auth.ProvideEmbeddedKeyService,
	wire.Bind(new(auth.KeyService), new(*auth.EmbeddedKeyService)),
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
