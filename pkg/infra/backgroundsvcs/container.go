package backgroundsvcs

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
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
	"golang.org/x/sync/errgroup"
)

func ProvideService(httpServer *api.HTTPServer, ng *ngalert.AlertNG, cleanup *cleanup.CleanUpService,
	live *live.GrafanaLive, pushGateway *pushhttp.Gateway, notifications *notifications.NotificationService,
	rendering *rendering.RenderingService, tokenService *auth.UserAuthTokenService,
	provisioning *provisioning.ProvisioningServiceImpl, alerting *alerting.AlertEngine, pm *manager.PluginManager,
	dashSvc *plugindashboards.Service, backendPM *backendmanager.Manager, metrics *metrics.InternalMetricsService,
	usageStats *usagestats.UsageStatsService, tracing *tracing.TracingService,
	remoteCache *remotecache.RemoteCache) *Container {
	return &Container{
		Services: []registry.BackgroundService{
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
			remoteCache,
		},
		logger: log.New("infra.backgroundsvcs"),
	}
}

type Service interface {
	// Run runs all background services.
	Run(ctx context.Context) *errgroup.Group
}

// Container contains the server's background services.
type Container struct {
	Services []registry.BackgroundService
	logger   log.Logger
}

func (c *Container) Run(ctx context.Context) *errgroup.Group {
	return c.RunServices(ctx, c.Services)
}

func (c *Container) RunServices(ctx context.Context, services []registry.BackgroundService) *errgroup.Group {
	eg, ctx := errgroup.WithContext(ctx)
	for _, svc := range services {
		canBeDisabled, ok := svc.(registry.CanBeDisabled)
		if ok && canBeDisabled.IsDisabled() {
			continue
		}

		// Variable is needed for accessing loop variable in callback
		service := svc
		eg.Go(func() error {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			err := service.Run(ctx)
			// Do not return context.Canceled error since errgroup.Group only
			// returns the first error to the caller - thus we can miss a more
			// interesting error.
			if err != nil && !errors.Is(err, context.Canceled) {
				c.logger.Error("Stopped background service", "reason", err)
				return fmt.Errorf("background service run error: %w", err)
			}
			c.logger.Debug("Stopped background service", "reason", err)
			return nil
		})
	}

	return eg
}
