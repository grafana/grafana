package backgroundsvcs

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	pluginStore "github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/notifications"
	plugindashboardsservice "github.com/grafana/grafana/pkg/services/plugindashboards/service"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/searchV2"
	secretsMigrations "github.com/grafana/grafana/pkg/services/secrets/kvstore/migrations"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	samanager "github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/sanitizer"
	"github.com/grafana/grafana/pkg/services/thumbs"
	"github.com/grafana/grafana/pkg/services/updatechecker"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/sync/errgroup"
)

func ProvideBackgroundServiceRegistry(
	httpServer *api.HTTPServer, ng *ngalert.AlertNG, cleanup *cleanup.CleanUpService, live *live.GrafanaLive,
	pushGateway *pushhttp.Gateway, notifications *notifications.NotificationService, processManager *process.Manager,
	rendering *rendering.RenderingService, tokenService auth.UserTokenBackgroundService, tracing tracing.Tracer,
	provisioning *provisioning.ProvisioningServiceImpl, alerting *alerting.AlertEngine, usageStats *uss.UsageStats,
	statsCollector *statscollector.Service, grafanaUpdateChecker *updatechecker.GrafanaService,
	pluginsUpdateChecker *updatechecker.PluginsService, metrics *metrics.InternalMetricsService,
	secretsService *secretsManager.SecretsService, remoteCache *remotecache.RemoteCache,
	thumbnailsService thumbs.Service, StorageService store.StorageService, searchService searchV2.SearchService, entityEventsService store.EntityEventsService,
	saService *samanager.ServiceAccountsService, authInfoService *authinfoservice.Implementation,
	secretMigrationProvider secretsMigrations.SecretMigrationProvider,
	usageStatsProvidersRegistry registry.UsageStatsProvidersRegistry,
	roleRegistry accesscontrol.RoleRegistry,
	provisioningService provisioning.ProvisioningService,
	pluginStore *pluginStore.Service,
	// Need to make sure these are initialized, is there a better place to put them?
	_ dashboardsnapshots.Service, _ *alerting.AlertNotificationService,
	_ serviceaccounts.Service, _ *guardian.Provider,
	_ *plugindashboardsservice.DashboardUpdater, _ *sanitizer.Provider,
) *BackgroundServiceRegistry {
	r := NewBackgroundServiceRegistry(
		pluginStore,
		httpServer,
		ng,
		cleanup,
		live,
		pushGateway,
		notifications,
		rendering,
		tokenService,
		provisioning,
		alerting,
		grafanaUpdateChecker,
		pluginsUpdateChecker,
		metrics,
		usageStats,
		statsCollector,
		tracing,
		remoteCache,
		secretsService,
		StorageService,
		thumbnailsService,
		searchService,
		entityEventsService,
		saService,
		authInfoService,
		processManager,
		secretMigrationProvider,
	)

	r.usageStatsProvidersRegistry = usageStatsProvidersRegistry
	r.statsCollectorService = statsCollector
	r.provisioningService = provisioningService

	return r
}

// BackgroundServiceRegistry provides background services.
type BackgroundServiceRegistry struct {
	*services.BasicService
	HTTPServer                  *api.HTTPServer
	userService                 user.Service
	loginAttemptService         loginattempt.Service
	statsCollectorService       *statscollector.Service
	usageStatsProvidersRegistry registry.UsageStatsProvidersRegistry
	provisioningService         provisioning.ProvisioningService

	log      log.Logger
	Services []registry.BackgroundService

	context          context.Context
	shutdownFn       context.CancelFunc
	childRoutines    *errgroup.Group
	cfg              *setting.Cfg
	shutdownOnce     sync.Once
	shutdownFinished chan struct{}
}

func NewBackgroundServiceRegistry(s ...registry.BackgroundService) *BackgroundServiceRegistry {
	rootCtx, shutdownFn := context.WithCancel(context.Background())
	childRoutines, childCtx := errgroup.WithContext(rootCtx)
	r := &BackgroundServiceRegistry{
		context:       childCtx,
		shutdownFn:    shutdownFn,
		childRoutines: childRoutines,
		Services:      s,
		log:           log.New("background-services"),
	}
	r.BasicService = services.NewBasicService(nil, r.run, r.stop)
	return r
}

func (r *BackgroundServiceRegistry) start(ctx context.Context) error {
	r.statsCollectorService.RegisterProviders(r.usageStatsProvidersRegistry.GetServices())
	login.ProvideService(r.HTTPServer.SQLStore, r.HTTPServer.Login, r.loginAttemptService, r.userService)
	social.ProvideService(r.cfg, r.HTTPServer.Features)
	if err := metrics.SetEnvironmentInformation(r.cfg.MetricsGrafanaEnvironmentInfo); err != nil {
		return err
	}
	return r.provisioningService.RunInitProvisioners(ctx)
}

func (r *BackgroundServiceRegistry) run(ctx context.Context) error {
	// Start background services.
	for _, svc := range r.Services {
		if registry.IsDisabled(svc) {
			continue
		}

		service := svc
		serviceName := reflect.TypeOf(service).String()
		r.childRoutines.Go(func() error {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			r.log.Debug("Starting background service", "service", serviceName)
			err := service.Run(ctx)
			// Do not return context.Canceled error since errgroup.Group only
			// returns the first error to the caller - thus we can miss a more
			// interesting error.
			if err != nil && !errors.Is(err, context.Canceled) {
				r.log.Error("Stopped background service", "service", serviceName, "reason", err)
				return fmt.Errorf("%s run error: %w", serviceName, err)
			}
			r.log.Debug("Stopped background service", "service", serviceName, "reason", err)
			return nil
		})
	}

	return r.childRoutines.Wait()
}

func (r *BackgroundServiceRegistry) stop(reason error) error {

	return reason
}

func (r *BackgroundServiceRegistry) GetServices() []registry.BackgroundService {
	return r.Services
}
