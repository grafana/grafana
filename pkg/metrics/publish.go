package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics/graphitepublisher"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

var metricsLogger log.Logger = log.New("metrics")
var metricPublishCounter int64 = 0

type logWrapper struct {
	logger log.Logger
}

func (lw *logWrapper) Println(v ...interface{}) {
	lw.logger.Info("graphite metric bridge", v...)
}

func Init() {
	settings := readSettings()
	initMetricVars(settings)
	//go instrumentationLoop(settings)

	cfg := &graphitepub.Config{
		URL:             "localhost:2003",
		Gatherer:        prometheus.DefaultGatherer,
		Prefix:          "prefix",
		Interval:        10 * time.Second,
		Timeout:         10 * time.Second,
		Logger:          &logWrapper{logger: metricsLogger},
		ErrorHandling:   graphitepub.ContinueOnError,
		CountersAsDelta: true,
	}

	bridge, err := graphitepub.NewBridge(cfg)
	if err != nil {
		metricsLogger.Error("failed to create graphite bridge", "error", err)
	} else {
		go bridge.Run(context.Background())
	}
}

func instrumentationLoop(settings *MetricSettings) chan struct{} {
	M_Instance_Start.Inc(1)

	onceEveryDayTick := time.NewTicker(time.Hour * 24)
	secondTicker := time.NewTicker(time.Second * time.Duration(settings.IntervalSeconds))

	for {
		select {
		case <-onceEveryDayTick.C:
			sendUsageStats()
		case <-secondTicker.C:
			if settings.Enabled {
				sendMetrics(settings)
			}
		}
	}
}

func sendMetrics(settings *MetricSettings) {
	if len(settings.Publishers) == 0 {
		return
	}

	updateTotalStats()

	metrics := MetricStats.GetSnapshots()

	for _, publisher := range settings.Publishers {
		publisher.Publish(metrics)
	}
}

func updateTotalStats() {
	// every interval also publish totals
	metricPublishCounter++
	if metricPublishCounter%10 == 0 {
		// get stats
		statsQuery := m.GetSystemStatsQuery{}
		if err := bus.Dispatch(&statsQuery); err != nil {
			metricsLogger.Error("Failed to get system stats", "error", err)
			return
		}

		M_StatTotal_Dashboards.Update(statsQuery.Result.Dashboards)
		M_StatTotal_Users.Update(statsQuery.Result.Users)
		M_StatTotal_Playlists.Update(statsQuery.Result.Playlists)
		M_StatTotal_Orgs.Update(statsQuery.Result.Orgs)
	}
}

func sendUsageStats() {
	if !setting.ReportingEnabled {
		return
	}

	metricsLogger.Debug("Sending anonymous usage stats to stats.grafana.org")

	version := strings.Replace(setting.BuildVersion, ".", "_", -1)

	metrics := map[string]interface{}{}
	report := map[string]interface{}{
		"version": version,
		"metrics": metrics,
		"os":      runtime.GOOS,
		"arch":    runtime.GOARCH,
	}

	statsQuery := m.GetSystemStatsQuery{}
	if err := bus.Dispatch(&statsQuery); err != nil {
		metricsLogger.Error("Failed to get system stats", "error", err)
		return
	}

	metrics["stats.dashboards.count"] = statsQuery.Result.Dashboards
	metrics["stats.users.count"] = statsQuery.Result.Users
	metrics["stats.orgs.count"] = statsQuery.Result.Orgs
	metrics["stats.playlist.count"] = statsQuery.Result.Playlists
	metrics["stats.plugins.apps.count"] = len(plugins.Apps)
	metrics["stats.plugins.panels.count"] = len(plugins.Panels)
	metrics["stats.plugins.datasources.count"] = len(plugins.DataSources)
	metrics["stats.alerts.count"] = statsQuery.Result.Alerts
	metrics["stats.active_users.count"] = statsQuery.Result.ActiveUsers
	metrics["stats.datasources.count"] = statsQuery.Result.Datasources

	dsStats := m.GetDataSourceStatsQuery{}
	if err := bus.Dispatch(&dsStats); err != nil {
		metricsLogger.Error("Failed to get datasource stats", "error", err)
		return
	}

	// send counters for each data source
	// but ignore any custom data sources
	// as sending that name could be sensitive information
	dsOtherCount := 0
	for _, dsStat := range dsStats.Result {
		if m.IsKnownDataSourcePlugin(dsStat.Type) {
			metrics["stats.ds."+dsStat.Type+".count"] = dsStat.Count
		} else {
			dsOtherCount += dsStat.Count
		}
	}
	metrics["stats.ds.other.count"] = dsOtherCount

	out, _ := json.MarshalIndent(report, "", " ")
	data := bytes.NewBuffer(out)

	client := http.Client{Timeout: time.Duration(5 * time.Second)}
	go client.Post("https://stats.grafana.org/grafana-usage-report", "application/json", data)
}
