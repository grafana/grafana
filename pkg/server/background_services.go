package server

import (
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	backendmanager "github.com/grafana/grafana/pkg/plugins/backendplugin/manager"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/plugindashboards"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/rendering"
)

func ProvideBackgroundServiceRegistry(httpServer *api.HTTPServer, ng *ngalert.AlertNG, cleanup *cleanup.CleanUpService,
	live *live.GrafanaLive, pushGateway *pushhttp.Gateway, notifications *notifications.NotificationService,
	rendering *rendering.RenderingService, tokenService *auth.UserAuthTokenService,
	provisioning *provisioning.ProvisioningServiceImpl, alerting *alerting.AlertEngine, pm *manager.PluginManager,
	dashSvc *plugindashboards.Service, backendPM *backendmanager.Manager, metrics *metrics.InternalMetricsService,
	usageStats *usagestats.UsageStatsService, tracing *tracing.TracingService,
	remoteCache *remotecache.RemoteCache) *registry.BackgroundServiceRegistry {
	return registry.NewBackgroundServiceRegistry(
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
		dashSvc,
		backendPM,
		metrics,
		usageStats,
		tracing,
		remoteCache)
}
