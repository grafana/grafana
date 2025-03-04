//go:build wireinject
// +build wireinject

// This file should contain wire sets used by both OSS and Enterprise builds.
// Use wireext_oss.go and wireext_enterprise.go for sets that are specific to
// the respective builds.
package server

import (
	"github.com/google/wire"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log/slogadapter"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	"github.com/grafana/grafana/pkg/infra/usagestats/validator"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/login/social/socialimpl"
	"github.com/grafana/grafana/pkg/middleware/csrf"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	apiregistry "github.com/grafana/grafana/pkg/registry/apis"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	appregistry "github.com/grafana/grafana/pkg/registry/apps"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/dualwrite"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsimpl"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/idimpl"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/cloudmigration/cloudmigrationimpl"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	dashboardimportservice "github.com/grafana/grafana/pkg/services/dashboardimport/service"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashsnapstore "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	dashsnapsvc "github.com/grafana/grafana/pkg/services/dashboardsnapshots/service"
	"github.com/grafana/grafana/pkg/services/dashboardversion/dashverimpl"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/encryption"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	extsvcreg "github.com/grafana/grafana/pkg/services/extsvcauth/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/hooks"
	ldapapi "github.com/grafana/grafana/pkg/services/ldap/api"
	ldapservice "github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattemptimpl"
	"github.com/grafana/grafana/pkg/services/navtree/navtreeimpl"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ngimage "github.com/grafana/grafana/pkg/services/ngalert/image"
	ngmetrics "github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/playlist/playlistimpl"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	plugindashboardsservice "github.com/grafana/grafana/pkg/services/plugindashboards/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	pluginDashboards "github.com/grafana/grafana/pkg/services/pluginsintegration/dashboards"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/preference/prefimpl"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsApi "github.com/grafana/grafana/pkg/services/publicdashboards/api"
	publicdashboardsStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	publicdashboardsmetric "github.com/grafana/grafana/pkg/services/publicdashboards/metric"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsDatabase "github.com/grafana/grafana/pkg/services/secrets/database"
	secretsStore "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsMigrations "github.com/grafana/grafana/pkg/services/secrets/kvstore/migrations"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
	serviceaccountsmanager "github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	serviceaccountsproxy "github.com/grafana/grafana/pkg/services/serviceaccounts/proxy"
	serviceaccountsretriever "github.com/grafana/grafana/pkg/services/serviceaccounts/retriever"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/shorturls/shorturlimpl"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeysimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoSettingsImpl "github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl"
	starApi "github.com/grafana/grafana/pkg/services/star/api"
	"github.com/grafana/grafana/pkg/services/star/starimpl"
	"github.com/grafana/grafana/pkg/services/stats/statsimpl"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/resolver"
	"github.com/grafana/grafana/pkg/services/store/sanitizer"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlesimpl"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team/teamapi"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/temp_user/tempuserimpl"
	"github.com/grafana/grafana/pkg/services/updatechecker"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	legacydualwrite "github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	unifiedsearch "github.com/grafana/grafana/pkg/storage/unified/search"
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
	"github.com/grafana/grafana/pkg/tsdb/jaeger"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/opentsdb"
	"github.com/grafana/grafana/pkg/tsdb/parca"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
	"github.com/grafana/grafana/pkg/tsdb/zipkin"
)

var wireBasicSet = wire.NewSet(
	annotationsimpl.ProvideService,
	wire.Bind(new(annotations.Repository), new(*annotationsimpl.RepositoryImpl)),
	New,
	api.ProvideHTTPServer,
	query.ProvideService,
	wire.Bind(new(query.Service), new(*query.ServiceImpl)),
	bus.ProvideBus,
	wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	rendering.ProvideService,
	wire.Bind(new(rendering.Service), new(*rendering.RenderingService)),
	routing.ProvideRegister,
	wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),
	hooks.ProvideService,
	kvstore.ProvideService,
	localcache.ProvideService,
	bundleregistry.ProvideService,
	wire.Bind(new(supportbundles.Service), new(*bundleregistry.Service)),
	updatechecker.ProvideGrafanaService,
	updatechecker.ProvidePluginsService,
	uss.ProvideService,
	wire.Bind(new(usagestats.Service), new(*uss.UsageStats)),
	validator.ProvideService,
	legacy.ProvideLegacyMigrator,
	pluginsintegration.WireSet,
	pluginDashboards.ProvideFileStoreManager,
	wire.Bind(new(pluginDashboards.FileStore), new(*pluginDashboards.FileStoreManager)),
	cloudwatch.ProvideService,
	cloudmonitoring.ProvideService,
	azuremonitor.ProvideService,
	postgres.ProvideService,
	mysql.ProvideService,
	mssql.ProvideService,
	store.ProvideEntityEventsService,
	legacydualwrite.ProvideService,
	httpclientprovider.New,
	wire.Bind(new(httpclient.Provider), new(*sdkhttpclient.Provider)),
	serverlock.ProvideService,
	annotationsimpl.ProvideCleanupService,
	wire.Bind(new(annotations.Cleaner), new(*annotationsimpl.CleanupServiceImpl)),
	cleanup.ProvideService,
	shorturlimpl.ProvideService,
	wire.Bind(new(shorturls.Service), new(*shorturlimpl.ShortURLService)),
	queryhistory.ProvideService,
	wire.Bind(new(queryhistory.Service), new(*queryhistory.QueryHistoryService)),
	correlations.ProvideService,
	wire.Bind(new(correlations.Service), new(*correlations.CorrelationsService)),
	quotaimpl.ProvideService,
	remotecache.ProvideService,
	wire.Bind(new(remotecache.CacheStorage), new(*remotecache.RemoteCache)),
	authinfoimpl.ProvideService,
	wire.Bind(new(login.AuthInfoService), new(*authinfoimpl.Service)),
	authinfoimpl.ProvideStore,
	datasourceproxy.ProvideService,
	sort.ProvideService,
	search.ProvideService,
	searchV2.ProvideService,
	searchV2.ProvideSearchHTTPService,
	store.ProvideService,
	store.ProvideSystemUsersService,
	live.ProvideService,
	pushhttp.ProvideService,
	contexthandler.ProvideService,
	ldapservice.ProvideService,
	wire.Bind(new(ldapservice.LDAP), new(*ldapservice.LDAPImpl)),
	jwt.ProvideService,
	wire.Bind(new(jwt.JWTService), new(*jwt.AuthService)),
	ngstore.ProvideDBStore,
	ngimage.ProvideDeleteExpiredService,
	ngalert.ProvideService,
	librarypanels.ProvideService,
	wire.Bind(new(librarypanels.Service), new(*librarypanels.LibraryPanelService)),
	libraryelements.ProvideService,
	wire.Bind(new(libraryelements.Service), new(*libraryelements.LibraryElementService)),
	notifications.ProvideService,
	notifications.ProvideSmtpService,
	tracing.ProvideService,
	tracing.ProvideTracingConfig,
	wire.Bind(new(tracing.Tracer), new(*tracing.TracingService)),
	testdatasource.ProvideService,
	ldapapi.ProvideService,
	opentsdb.ProvideService,
	socialimpl.ProvideService,
	influxdb.ProvideService,
	wire.Bind(new(social.Service), new(*socialimpl.SocialService)),
	tempo.ProvideService,
	loki.ProvideService,
	graphite.ProvideService,
	prometheus.ProvideService,
	elasticsearch.ProvideService,
	pyroscope.ProvideService,
	parca.ProvideService,
	zipkin.ProvideService,
	jaeger.ProvideService,
	datasourceservice.ProvideCacheService,
	wire.Bind(new(datasources.CacheService), new(*datasourceservice.CacheServiceImpl)),
	encryptionservice.ProvideEncryptionService,
	wire.Bind(new(encryption.Internal), new(*encryptionservice.Service)),
	secretsManager.ProvideSecretsService,
	wire.Bind(new(secrets.Service), new(*secretsManager.SecretsService)),
	secretsDatabase.ProvideSecretsStore,
	wire.Bind(new(secrets.Store), new(*secretsDatabase.SecretsStoreImpl)),
	grafanads.ProvideService,
	wire.Bind(new(dashboardsnapshots.Store), new(*dashsnapstore.DashboardSnapshotStore)),
	dashsnapstore.ProvideStore,
	wire.Bind(new(dashboardsnapshots.Service), new(*dashsnapsvc.ServiceImpl)),
	dashsnapsvc.ProvideService,
	datasourceservice.ProvideService,
	wire.Bind(new(datasources.DataSourceService), new(*datasourceservice.Service)),
	datasourceservice.ProvideLegacyDataSourceLookup,
	serviceaccountsretriever.ProvideService,
	wire.Bind(new(serviceaccounts.ServiceAccountRetriever), new(*serviceaccountsretriever.Service)),
	ossaccesscontrol.ProvideServiceAccountPermissions,
	wire.Bind(new(accesscontrol.ServiceAccountPermissionsService), new(*ossaccesscontrol.ServiceAccountPermissionsService)),
	serviceaccountsmanager.ProvideServiceAccountsService,
	serviceaccountsproxy.ProvideServiceAccountsProxy,
	wire.Bind(new(serviceaccounts.Service), new(*serviceaccountsproxy.ServiceAccountsProxy)),
	expr.ProvideService,
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	dashboardservice.ProvideDashboardServiceImpl,
	wire.Bind(new(dashboards.PermissionsRegistrationService), new(*dashboardservice.DashboardServiceImpl)),
	dashboardservice.ProvideDashboardService,
	dashboardservice.ProvideDashboardProvisioningService,
	dashboardservice.ProvideDashboardPluginService,
	dashboardstore.ProvideDashboardStore,
	folderimpl.ProvideService,
	wire.Bind(new(folder.Service), new(*folderimpl.Service)),
	folderimpl.ProvideStore,
	wire.Bind(new(folder.Store), new(*folderimpl.FolderStoreImpl)),
	folderimpl.ProvideDashboardFolderStore,
	wire.Bind(new(folder.FolderStore), new(*folderimpl.DashboardFolderStoreImpl)),
	dashboardimportservice.ProvideService,
	wire.Bind(new(dashboardimport.Service), new(*dashboardimportservice.ImportDashboardService)),
	plugindashboardsservice.ProvideService,
	wire.Bind(new(plugindashboards.Service), new(*plugindashboardsservice.Service)),
	plugindashboardsservice.ProvideDashboardUpdater,
	guardian.ProvideService,
	sanitizer.ProvideService,
	secretsStore.ProvideService,
	avatar.ProvideAvatarCacheServer,
	statscollector.ProvideService,
	csrf.ProvideCSRFFilter,
	wire.Bind(new(csrf.Service), new(*csrf.CSRF)),
	ossaccesscontrol.ProvideTeamPermissions,
	wire.Bind(new(accesscontrol.TeamPermissionsService), new(*ossaccesscontrol.TeamPermissionsService)),
	ossaccesscontrol.ProvideFolderPermissions,
	wire.Bind(new(accesscontrol.FolderPermissionsService), new(*ossaccesscontrol.FolderPermissionsService)),
	ossaccesscontrol.ProvideDashboardPermissions,
	wire.Bind(new(accesscontrol.DashboardPermissionsService), new(*ossaccesscontrol.DashboardPermissionsService)),
	ossaccesscontrol.ProvideReceiverPermissionsService,
	wire.Bind(new(accesscontrol.ReceiverPermissionsService), new(*ossaccesscontrol.ReceiverPermissionsService)),
	starimpl.ProvideService,
	playlistimpl.ProvideService,
	apikeyimpl.ProvideService,
	dashverimpl.ProvideService,
	publicdashboardsService.ProvideService,
	wire.Bind(new(publicdashboards.Service), new(*publicdashboardsService.PublicDashboardServiceImpl)),
	publicdashboardsStore.ProvideStore,
	wire.Bind(new(publicdashboards.Store), new(*publicdashboardsStore.PublicDashboardStoreImpl)),
	publicdashboardsmetric.ProvideService,
	publicdashboardsApi.ProvideApi,
	starApi.ProvideApi,
	userimpl.ProvideService,
	orgimpl.ProvideService,
	orgimpl.ProvideDeletionService,
	statsimpl.ProvideService,
	grpccontext.ProvideContextHandler,
	grpcserver.ProvideService,
	grpcserver.ProvideHealthService,
	grpcserver.ProvideReflectionService,
	interceptors.ProvideAuthenticator,
	resolver.ProvideEntityReferenceResolver,
	teamimpl.ProvideService,
	teamapi.ProvideTeamAPI,
	tempuserimpl.ProvideService,
	loginattemptimpl.ProvideService,
	wire.Bind(new(loginattempt.Service), new(*loginattemptimpl.Service)),
	secretsMigrations.ProvideDataSourceMigrationService,
	secretsMigrations.ProvideMigrateToPluginService,
	secretsMigrations.ProvideMigrateFromPluginService,
	secretsMigrations.ProvideSecretMigrationProvider,
	wire.Bind(new(secretsMigrations.SecretMigrationProvider), new(*secretsMigrations.SecretMigrationProviderImpl)),
	resourcepermissions.NewActionSetService,
	wire.Bind(new(accesscontrol.ActionResolver), new(resourcepermissions.ActionSetService)),
	wire.Bind(new(pluginaccesscontrol.ActionSetRegistry), new(resourcepermissions.ActionSetService)),
	permreg.ProvidePermissionRegistry,
	acimpl.ProvideAccessControl,
	dualwrite.ProvideZanzanaReconciler,
	navtreeimpl.ProvideService,
	wire.Bind(new(accesscontrol.AccessControl), new(*acimpl.AccessControl)),
	wire.Bind(new(notifications.TempUserStore), new(tempuser.Service)),
	tagimpl.ProvideService,
	wire.Bind(new(tag.Service), new(*tagimpl.Service)),
	authnimpl.ProvideService,
	authnimpl.ProvideIdentitySynchronizer,
	authnimpl.ProvideAuthnService,
	authnimpl.ProvideAuthnServiceAuthenticateOnly,
	authnimpl.ProvideRegistration,
	supportbundlesimpl.ProvideService,
	extsvcaccounts.ProvideExtSvcAccountsService,
	wire.Bind(new(serviceaccounts.ExtSvcAccountsService), new(*extsvcaccounts.ExtSvcAccountsService)),
	extsvcreg.ProvideExtSvcRegistry,
	wire.Bind(new(extsvcauth.ExternalServiceRegistry), new(*extsvcreg.Registry)),
	anonstore.ProvideAnonDBStore,
	wire.Bind(new(anonstore.AnonStore), new(*anonstore.AnonDBStore)),
	loggermw.Provide,
	slogadapter.Provide,
	signingkeysimpl.ProvideEmbeddedSigningKeysService,
	wire.Bind(new(signingkeys.Service), new(*signingkeysimpl.Service)),
	ssoSettingsImpl.ProvideService,
	wire.Bind(new(ssosettings.Service), new(*ssoSettingsImpl.Service)),
	idimpl.ProvideService,
	wire.Bind(new(auth.IDService), new(*idimpl.Service)),
	cloudmigrationimpl.ProvideService,
	userimpl.ProvideVerifier,
	connectors.ProvideOrgRoleMapper,
	wire.Bind(new(user.Verifier), new(*userimpl.Verifier)),
	authz.WireSet,
	// Unified storage
	resource.ProvideStorageMetrics,
	// Kubernetes API server
	grafanaapiserver.WireSet,
	apiregistry.WireSet,
	appregistry.WireSet,
)

var wireSet = wire.NewSet(
	wireBasicSet,
	metrics.WireSet,
	sqlstore.ProvideService,
	ngmetrics.ProvideService,
	wire.Bind(new(notifications.Service), new(*notifications.NotificationService)),
	wire.Bind(new(notifications.WebhookSender), new(*notifications.NotificationService)),
	wire.Bind(new(notifications.EmailSender), new(*notifications.NotificationService)),
	wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
	prefimpl.ProvideService,
	oauthtoken.ProvideService,
	wire.Bind(new(oauthtoken.OAuthTokenService), new(*oauthtoken.Service)),
)

var wireCLISet = wire.NewSet(
	NewRunner,
	wireBasicSet,
	metrics.WireSet,
	sqlstore.ProvideService,
	ngmetrics.ProvideService,
	wire.Bind(new(notifications.Service), new(*notifications.NotificationService)),
	wire.Bind(new(notifications.WebhookSender), new(*notifications.NotificationService)),
	wire.Bind(new(notifications.EmailSender), new(*notifications.NotificationService)),
	wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
	prefimpl.ProvideService,
	oauthtoken.ProvideService,
	wire.Bind(new(oauthtoken.OAuthTokenService), new(*oauthtoken.Service)),
)

var wireTestSet = wire.NewSet(
	wireBasicSet,
	ProvideTestEnv,
	metrics.WireSetForTest,
	sqlstore.ProvideServiceForTests,
	ngmetrics.ProvideServiceForTest,
	notifications.MockNotificationService,
	wire.Bind(new(notifications.Service), new(*notifications.NotificationServiceMock)),
	wire.Bind(new(notifications.WebhookSender), new(*notifications.NotificationServiceMock)),
	wire.Bind(new(notifications.EmailSender), new(*notifications.NotificationServiceMock)),
	wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
	prefimpl.ProvideService,
	oauthtoken.ProvideService,
	oauthtokentest.ProvideService,
	wire.Bind(new(oauthtoken.OAuthTokenService), new(*oauthtokentest.Service)),
)

func Initialize(cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*Server, error) {
	wire.Build(wireExtsSet)
	return &Server{}, nil
}

func InitializeForTest(t sqlutil.ITestDB, cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*TestEnv, error) {
	wire.Build(wireExtsTestSet)
	return &TestEnv{Server: &Server{}, SQLStore: &sqlstore.SQLStore{}, Cfg: &setting.Cfg{}}, nil
}

func InitializeForCLI(cfg *setting.Cfg) (Runner, error) {
	wire.Build(wireExtsCLISet)
	return Runner{}, nil
}

// InitializeForCLITarget is a simplified set of dependencies for the CLI, used
// by the server target subcommand to launch specific dskit modules.
func InitializeForCLITarget(cfg *setting.Cfg) (ModuleRunner, error) {
	wire.Build(wireExtsBaseCLISet)
	return ModuleRunner{}, nil
}

// InitializeModuleServer is a simplified set of dependencies for the CLI,
// suitable for running background services and targeting dskit modules.
func InitializeModuleServer(cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*ModuleServer, error) {
	wire.Build(wireExtsModuleServerSet)
	return &ModuleServer{}, nil
}

// Initialize the standalone APIServer factory
func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	wire.Build(wireExtsStandaloneAPIServerSet)
	return &standalone.NoOpAPIServerFactory{}, nil // Wire will replace this with a real interface
}

func InitializeDocumentBuilders(cfg *setting.Cfg) (resource.DocumentBuilderSupplier, error) {
	wire.Build(wireExtsSet)
	return &unifiedsearch.StandardDocumentBuilders{}, nil
}
