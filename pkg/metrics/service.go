package metrics

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics/graphitebridge"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var metricsLogger log.Logger = log.New("metrics")

type logWrapper struct {
	logger log.Logger
}

func (lw *logWrapper) Println(v ...interface{}) {
	lw.logger.Info("graphite metric bridge", v...)
}

func init() {
	registry.RegisterService(&InternalMetricsService{})
	initMetricVars()
}

type InternalMetricsService struct {
	Cfg *setting.Cfg `inject:""`

	intervalSeconds int64
	graphiteCfg     *graphitebridge.Config
	oauthProviders  map[string]bool
}

func (im *InternalMetricsService) Init() error {
	return im.readSettings()
}

func (im *InternalMetricsService) Run(ctx context.Context) error {
	// Start Graphite Bridge
	if im.graphiteCfg != nil {
		bridge, err := graphitebridge.NewBridge(im.graphiteCfg)
		if err != nil {
			metricsLogger.Error("failed to create graphite bridge", "error", err)
		} else {
			go bridge.Run(ctx)
		}
	}

	M_Instance_Start.Inc()

	// set the total stats gauges before we publishing metrics
	updateTotalStats()

	onceEveryDayTick := time.NewTicker(time.Hour * 24)
	everyMinuteTicker := time.NewTicker(time.Minute)
	defer onceEveryDayTick.Stop()
	defer everyMinuteTicker.Stop()

	for {
		select {
		case <-onceEveryDayTick.C:
			sendUsageStats(im.oauthProviders)
		case <-everyMinuteTicker.C:
			updateTotalStats()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
