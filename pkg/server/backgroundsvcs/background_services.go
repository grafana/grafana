package backgroundsvcs

import (
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/rendering"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/thumbs"
	"github.com/grafana/grafana/pkg/services/updatechecker"
)

func ProvideBackgroundServiceRegistry(
	httpServer *api.HTTPServer, ng *ngalert.AlertNG, cleanup *cleanup.CleanUpService, live *live.GrafanaLive,
	pushGateway *pushhttp.Gateway, notifications *notifications.NotificationService, pm *manager.PluginManager,
	rendering *rendering.RenderingService, tokenService models.UserTokenBackgroundService, tracing tracing.Tracer,
	provisioning *provisioning.ProvisioningServiceImpl, alerting *alerting.AlertEngine, usageStats *uss.UsageStats,
	grafanaUpdateChecker *updatechecker.GrafanaService, pluginsUpdateChecker *updatechecker.PluginsService,
	metrics *metrics.InternalMetricsService, secretsService *secretsManager.SecretsService,
	remoteCache *remotecache.RemoteCache, thumbnailsService thumbs.Service,
	// Need to make sure these are initialized, is there a better place to put them?
	_ *plugindashboards.Service, _ *dashboardsnapshots.Service, _ *pluginsettings.ServiceImpl,
	_ *alerting.AlertNotificationService, _ serviceaccounts.Service,
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
		alerting,
		pm,
		grafanaUpdateChecker,
		pluginsUpdateChecker,
		metrics,
		usageStats,
		tracing,
		remoteCache,
		secretsService,
		thumbnailsService)
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
