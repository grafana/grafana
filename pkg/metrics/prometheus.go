package metrics

import (
	"github.com/grafana/grafana/pkg/log"
	"github.com/prometheus/client_golang/prometheus"
	"net/http"
	"strings"
)

const (
	namespace = "grafana"
	subsystem = "backend"
)

type PrometheusPublisher struct {
	CounterCollectors map[string]*prometheus.CounterVec
	GaugeCollectors   map[string]*prometheus.GaugeVec
}

func CreatePrometheusPublisher() (*PrometheusPublisher, error) {
	go func() {
		http.Handle("/metrics", prometheus.Handler())
		err := http.ListenAndServe(":9200", nil)
		if err != nil {
			log.Error(3, "Metrics: PrometheusPublisher:  Failed to listen, %s", err)
		}
	}()

	publisher := &PrometheusPublisher{
		CounterCollectors: make(map[string]*prometheus.CounterVec),
		GaugeCollectors:   make(map[string]*prometheus.GaugeVec),
	}

	return publisher, nil
}

func (this *PrometheusPublisher) Publish(metrics []Metric) {
	for _, m := range metrics {
		metricName := convertMetricName(m.Name())
		labels := m.GetTagsCopy()
		var labelKeys []string
		for k := range labels {
			labelKeys = append(labelKeys, k)
		}

		switch metric := m.(type) {
		case Counter:
			entry := this.registerAndGetCounter(metricName, labelKeys)
			entry.With(labels).Add(float64(metric.Count()))
		case Gauge:
			entry := this.registerAndGetGauge(metricName, labelKeys)
			entry.With(labels).Set(float64(metric.Value()))
		case Timer:
			for _, t := range []string{"count", "sum"} {
				entry := this.registerAndGetCounter(metricName+"_"+t, labelKeys)
				switch t {
				case "count":
					entry.With(labels).Add(float64(metric.Count()))
				case "sum":
					entry.With(labels).Add(float64(metric.Sum()))
				}
			}

			for _, t := range []string{"max", "min", "mean", "std"} {
				entry := this.registerAndGetGauge(metricName+"_"+t, labelKeys)
				switch t {
				case "max":
					entry.With(labels).Set(float64(metric.Max()))
				case "min":
					entry.With(labels).Set(float64(metric.Min()))
				case "mean":
					entry.With(labels).Set(float64(metric.Mean()))
				case "std":
					entry.With(labels).Set(float64(metric.StdDev()))
				}
			}

			percentiles := metric.Percentiles([]float64{0.25, 0.75, 0.90, 0.99})
			percentileLabels := m.GetTagsCopy()
			percentileLabels["quantile"] = "0"
			var percentileLabelKeys []string
			for k := range percentileLabels {
				percentileLabelKeys = append(percentileLabelKeys, k)
			}
			for i, t := range []string{"0.25", "0.75", "0.90", "0.99"} {
				entry := this.registerAndGetGauge(metricName, percentileLabelKeys)
				percentileLabels["quantile"] = t

				switch t {
				case "0.25":
					entry.With(percentileLabels).Set(float64(percentiles[i]))
				case "0.75":
					entry.With(percentileLabels).Set(float64(percentiles[i]))
				case "0.90":
					entry.With(percentileLabels).Set(float64(percentiles[i]))
				case "0.99":
					entry.With(percentileLabels).Set(float64(percentiles[i]))
				}
			}
		}
	}
}

func convertMetricName(metricName string) string {
	return strings.Replace(metricName, ".", "_", -1)
}

func getMetricId(metricName string, labelKeys []string) string {
	return metricName + "_" + strings.Join(labelKeys[:], "_")
}

func (this *PrometheusPublisher) registerAndGetCounter(metricName string, labelKeys []string) *prometheus.CounterVec {
	help := metricName // dummy
	metricId := getMetricId(metricName, labelKeys)

	entry, ok := this.CounterCollectors[metricId]
	if !ok {
		entry = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      metricName,
				Help:      help,
			},
			labelKeys,
		)
		this.CounterCollectors[metricId] = entry
		prometheus.MustRegister(this.CounterCollectors[metricId])
	}
	return entry
}

func (this *PrometheusPublisher) registerAndGetGauge(metricName string, labelKeys []string) *prometheus.GaugeVec {
	help := metricName // dummy
	metricId := getMetricId(metricName, labelKeys)

	entry, ok := this.GaugeCollectors[metricId]
	if !ok {
		entry = prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      metricName,
				Help:      help,
			},
			labelKeys,
		)
		this.GaugeCollectors[metricId] = entry
		prometheus.MustRegister(this.GaugeCollectors[metricId])
	}
	return entry
}
