package collector

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

// Namespace collector metric namespace
const Namespace = "grafana_plugin"

var (
	scrapeDurationDesc = prometheus.NewDesc(
		prometheus.BuildFQName(Namespace, "scrape", "duration_seconds"),
		"grafana_plugin: Duration of a plugin collector scrape.",
		[]string{"plugin_id"},
		nil,
	)
	scrapeSuccessDesc = prometheus.NewDesc(
		prometheus.BuildFQName(Namespace, "scrape", "success"),
		"grafana_plugin: Whether a plugin collector succeeded.",
		[]string{"plugin_id"},
		nil,
	)
)

// Collector is the interface a plugin collector has to implement.
type Collector interface {
	// Get new metrics and expose them via prometheus registry.
	CollectMetrics(ctx context.Context, ch chan<- prometheus.Metric) error
}

// PluginCollector implements the prometheus.Collector interface.
type PluginCollector struct {
	collectors map[string]Collector
	logger     log.Logger
}

// NewPluginCollector creates a new PluginCollector..
func NewPluginCollector() PluginCollector {
	return PluginCollector{
		collectors: make(map[string]Collector),
		logger:     log.New("plugins.backend.collector"),
	}
}

func (pc PluginCollector) Register(pluginID string, c Collector) {
	pc.collectors[pluginID] = c
}

// Describe implements the prometheus.Collector interface.
func (pc PluginCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- scrapeDurationDesc
	ch <- scrapeSuccessDesc
}

// Collect implements the prometheus.Collector interface.
func (pc PluginCollector) Collect(ch chan<- prometheus.Metric) {
	ctx := context.Background()
	wg := sync.WaitGroup{}
	wg.Add(len(pc.collectors))
	for name, c := range pc.collectors {
		go func(name string, c Collector) {
			execute(ctx, name, c, ch, pc.logger)
			wg.Done()
		}(name, c)
	}
	wg.Wait()
}

func execute(ctx context.Context, pluginID string, c Collector, ch chan<- prometheus.Metric, logger log.Logger) {
	begin := time.Now()
	err := c.CollectMetrics(ctx, ch)
	duration := time.Since(begin)
	var success float64

	if err != nil {
		logger.Error("collector failed", "pluginId", pluginID, "took", duration, "error", err)
		success = 0
	} else {
		logger.Debug("collector succeeded", "pluginId", pluginID, "took", duration)
		success = 1
	}
	ch <- prometheus.MustNewConstMetric(scrapeDurationDesc, prometheus.GaugeValue, duration.Seconds(), pluginID)
	ch <- prometheus.MustNewConstMetric(scrapeSuccessDesc, prometheus.GaugeValue, success, pluginID)
}
