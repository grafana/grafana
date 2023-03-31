package backgroundsvcs

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/dskit/services"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/guardian"
	ldapapi "github.com/grafana/grafana/pkg/services/ldap/api"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattemptimpl"
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
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/sanitizer"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlesimpl"
	"github.com/grafana/grafana/pkg/services/thumbs"
	"github.com/grafana/grafana/pkg/services/updatechecker"
)

func ProvideBackgroundServiceRegistry(
	ng *ngalert.AlertNG, cleanup *cleanup.CleanUpService, live *live.GrafanaLive,
	pushGateway *pushhttp.Gateway, notifications *notifications.NotificationService,
	rendering *rendering.RenderingService, tokenService auth.UserTokenBackgroundService, tracing tracing.Tracer,
	provisioning *provisioning.ProvisioningServiceImpl, alerting *alerting.AlertEngine, usageStats *uss.UsageStats,
	statsCollector *statscollector.Service, grafanaUpdateChecker *updatechecker.GrafanaService,
	pluginsUpdateChecker *updatechecker.PluginsService, metrics *metrics.InternalMetricsService,
	secretsService *secretsManager.SecretsService, remoteCache *remotecache.RemoteCache,
	thumbnailsService thumbs.Service, StorageService store.StorageService, searchService searchV2.SearchService, entityEventsService store.EntityEventsService,
	saService *samanager.ServiceAccountsService, authInfoService *authinfoservice.Implementation,
	secretMigrationProvider secretsMigrations.SecretMigrationProvider, loginAttemptService *loginattemptimpl.Service,
	bundleService *supportbundlesimpl.Service,
	usageStatsProvidersRegistry registry.UsageStatsProvidersRegistry,
	provisioningService provisioning.ProvisioningService,
	moduleManager modules.Manager,
	// Need to make sure these are initialized, is there a better place to put them?
	_ dashboardsnapshots.Service, _ *alerting.AlertNotificationService,
	_ serviceaccounts.Service, _ *guardian.Provider,
	dashboardUpdater *plugindashboardsservice.DashboardUpdater, _ *sanitizer.Provider,
	_ *grpcserver.HealthService, _ entity.EntityStoreServer, _ *grpcserver.ReflectionService, _ *ldapapi.Service,
) (*BackgroundServiceRegistry, error) {
	r := NewBackgroundServiceRegistry(
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
		secretMigrationProvider,
		loginAttemptService,
		bundleService,
		dashboardUpdater,
	)

	moduleManager.RegisterModule(modules.Core, func() (services.Service, error) {
		return services.NewBasicService(r.start, r.run, r.stop), nil
	}, modules.Plugins)

	r.usageStatsProvidersRegistry = usageStatsProvidersRegistry
	r.statsCollectorService = statsCollector
	r.provisioningService = provisioningService

	return r, nil
}

// BackgroundServiceRegistry provides background services.
type BackgroundServiceRegistry struct {
	statsCollectorService       *statscollector.Service
	usageStatsProvidersRegistry registry.UsageStatsProvidersRegistry
	provisioningService         provisioning.ProvisioningService

	log      log.Logger
	Services []registry.BackgroundService
}

func NewBackgroundServiceRegistry(s ...registry.BackgroundService) *BackgroundServiceRegistry {
	return &BackgroundServiceRegistry{
		Services: s,
		log:      log.New("background-services"),
	}
}

func (r *BackgroundServiceRegistry) start(ctx context.Context) error {
	r.statsCollectorService.RegisterProviders(r.usageStatsProvidersRegistry.GetServices())
	return r.provisioningService.RunInitProvisioners(ctx)
}

func (r *BackgroundServiceRegistry) run(ctx context.Context) error {
	childRoutines, childCtx := errgroup.WithContext(ctx)

	// Start background services.
	for _, svc := range r.Services {
		if registry.IsDisabled(svc) {
			continue
		}

		service := svc
		serviceName := reflect.TypeOf(service).String()
		childRoutines.Go(func() error {
			select {
			case <-childCtx.Done():
				return childCtx.Err()
			default:
			}
			err := service.Run(childCtx)
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

	return childRoutines.Wait()
}

func (r *BackgroundServiceRegistry) stop(err error) error {
	return err
}

func (r *BackgroundServiceRegistry) GetServices() []registry.BackgroundService {
	return r.Services
}
