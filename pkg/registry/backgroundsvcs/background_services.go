package backgroundsvcs

import (
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	"github.com/grafana/grafana/pkg/registry"
	apiregistry "github.com/grafana/grafana/pkg/registry/apis"
	appregistry "github.com/grafana/grafana/pkg/registry/apps"
	"github.com/grafana/grafana/pkg/services/accesscontrol/dualwrite"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/guardian"
	ldapapi "github.com/grafana/grafana/pkg/services/ldap/api"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattemptimpl"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/notifications"
	plugindashboardsservice "github.com/grafana/grafana/pkg/services/plugindashboards/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetectorsprovider"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginexternal"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	pluginStore "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/provisioning"
	publicdashboardsmetric "github.com/grafana/grafana/pkg/services/publicdashboards/metric"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/searchV2"
	secretsMigrations "github.com/grafana/grafana/pkg/services/secrets/kvstore/migrations"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	samanager "github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/sanitizer"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlesimpl"
	"github.com/grafana/grafana/pkg/services/team/teamapi"
	"github.com/grafana/grafana/pkg/services/updatechecker"
)

func ProvideBackgroundServiceRegistry(
	httpServer *api.HTTPServer, ng *ngalert.AlertNG, cleanup *cleanup.CleanUpService, live *live.GrafanaLive,
	pushGateway *pushhttp.Gateway, notifications *notifications.NotificationService, pluginStore *pluginStore.Service,
	rendering *rendering.RenderingService, tokenService auth.UserTokenBackgroundService, tracing *tracing.TracingService,
	provisioning *provisioning.ProvisioningServiceImpl, usageStats *uss.UsageStats,
	statsCollector *statscollector.Service, grafanaUpdateChecker *updatechecker.GrafanaService,
	pluginsUpdateChecker *updatechecker.PluginsService, metrics *metrics.InternalMetricsService,
	secretsService *secretsManager.SecretsService, remoteCache *remotecache.RemoteCache, StorageService store.StorageService, searchService searchV2.SearchService, entityEventsService store.EntityEventsService,
	saService *samanager.ServiceAccountsService, grpcServerProvider grpcserver.Provider,
	secretMigrationProvider secretsMigrations.SecretMigrationProvider, loginAttemptService *loginattemptimpl.Service,
	bundleService *supportbundlesimpl.Service, publicDashboardsMetric *publicdashboardsmetric.Service,
	keyRetriever *dynamic.KeyRetriever, dynamicAngularDetectorsProvider *angulardetectorsprovider.Dynamic,
	grafanaAPIServer grafanaapiserver.Service,
	anon *anonimpl.AnonDeviceService,
	ssoSettings *ssosettingsimpl.Service,
	pluginExternal *pluginexternal.Service,
	pluginInstaller *plugininstaller.Service,
	zanzanaReconciler *dualwrite.ZanzanaReconciler,
	appRegistry *appregistry.Service,
	// Need to make sure these are initialized, is there a better place to put them?
	_ dashboardsnapshots.Service,
	_ serviceaccounts.Service, _ *guardian.Provider,
	_ *plugindashboardsservice.DashboardUpdater, _ *sanitizer.Provider,
	_ *grpcserver.HealthService, _ *grpcserver.ReflectionService,
	_ *ldapapi.Service, _ *apiregistry.Service, _ auth.IDService, _ *teamapi.TeamAPI, _ ssosettings.Service,
	_ cloudmigration.Service, _ authnimpl.Registration,
) *BackgroundServiceRegistry {
	return NewBackgroundServiceRegistry(
		httpServer,
		ng,
		cleanup,
		live,
		pushGateway,
		notifications,
		rendering,
		tokenService,
		provisioning,
		grafanaUpdateChecker,
		pluginsUpdateChecker,
		metrics,
		usageStats,
		statsCollector,
		tracing,
		remoteCache,
		secretsService,
		StorageService,
		searchService,
		entityEventsService,
		grpcServerProvider,
		saService,
		pluginStore,
		secretMigrationProvider,
		loginAttemptService,
		bundleService,
		publicDashboardsMetric,
		keyRetriever,
		dynamicAngularDetectorsProvider,
		grafanaAPIServer,
		anon,
		ssoSettings,
		pluginExternal,
		pluginInstaller,
		zanzanaReconciler,
		appRegistry,
	)
}

// BackgroundServiceRegistry provides background services.
type BackgroundServiceRegistry struct {
	Services []registry.BackgroundService
}

func NewBackgroundServiceRegistry(services ...registry.BackgroundService) *BackgroundServiceRegistry {
	return &BackgroundServiceRegistry{services}
}

func (r *BackgroundServiceRegistry) GetServices() []registry.BackgroundService {
	return r.Services
}
