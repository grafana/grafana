package metrics

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/metrics/graphitebridge"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	ini "gopkg.in/ini.v1"
)

type MetricSettings struct {
	Enabled              bool
	IntervalSeconds      int64
	GraphiteBridgeConfig *graphitebridge.Config
}

func ReadSettings(file *ini.File) *MetricSettings {
	var settings = &MetricSettings{
		Enabled: false,
	}

	var section, err = file.GetSection("metrics")
	if err != nil {
		metricsLogger.Crit("Unable to find metrics config section", "error", err)
		return nil
	}

	settings.Enabled = section.Key("enabled").MustBool(false)
	settings.IntervalSeconds = section.Key("interval_seconds").MustInt64(10)

	if !settings.Enabled {
		return settings
	}

	cfg, err := parseGraphiteSettings(settings, file)
	if err != nil {
		metricsLogger.Crit("Unable to parse metrics graphite section", "error", err)
		return nil
	}

	settings.GraphiteBridgeConfig = cfg

	return settings
}

func parseGraphiteSettings(settings *MetricSettings, file *ini.File) (*graphitebridge.Config, error) {
	graphiteSection, err := setting.Cfg.GetSection("metrics.graphite")
	if err != nil {
		return nil, nil
	}

	address := graphiteSection.Key("address").String()
	if address == "" {
		return nil, nil
	}

	cfg := &graphitebridge.Config{
		URL:             address,
		Prefix:          graphiteSection.Key("prefix").MustString("prod.grafana.%(instance_name)s"),
		CountersAsDelta: true,
		Gatherer:        prometheus.DefaultGatherer,
		Interval:        time.Duration(settings.IntervalSeconds) * time.Second,
		Timeout:         10 * time.Second,
		Logger:          &logWrapper{logger: metricsLogger},
		ErrorHandling:   graphitebridge.ContinueOnError,
	}

	safeInstanceName := strings.Replace(setting.InstanceName, ".", "_", -1)
	prefix := graphiteSection.Key("prefix").Value()

	if prefix == "" {
		prefix = "prod.grafana.%(instance_name)s."
	}

	cfg.Prefix = strings.Replace(prefix, "%(instance_name)s", safeInstanceName, -1)
	return cfg, nil
}
