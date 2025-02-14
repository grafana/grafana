package metrics

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics/graphitebridge"
)

func (im *InternalMetricsService) readSettings() error {
	var section, err = im.Cfg.Raw.GetSection("metrics")
	if err != nil {
		return fmt.Errorf("unable to find metrics config section: %w", err)
	}

	im.intervalSeconds = section.Key("interval_seconds").MustInt64(10)

	if err := im.parseGraphiteSettings(); err != nil {
		return fmt.Errorf("unable to parse metrics graphite section: %w", err)
	}

	return nil
}

func (im *InternalMetricsService) parseGraphiteSettings() error {
	graphiteSection, err := im.Cfg.Raw.GetSection("metrics.graphite")
	if err != nil {
		return nil
	}

	address := graphiteSection.Key("address").String()
	if address == "" {
		return nil
	}

	bridgeCfg := &graphitebridge.Config{
		URL:             address,
		Prefix:          graphiteSection.Key("prefix").MustString("prod.grafana.%(instance_name)s"),
		CountersAsDelta: true,
		Gatherer:        im.gatherer,
		Interval:        time.Duration(im.intervalSeconds) * time.Second,
		Timeout:         10 * time.Second,
		Logger:          &logWrapper{logger: metricsLogger},
		ErrorHandling:   graphitebridge.ContinueOnError,
	}

	safeInstanceName := strings.ReplaceAll(im.Cfg.InstanceName, ".", "_")
	prefix := graphiteSection.Key("prefix").Value()

	if prefix == "" {
		prefix = "prod.grafana.%(instance_name)s."
	}

	bridgeCfg.Prefix = strings.ReplaceAll(prefix, "%(instance_name)s", safeInstanceName)

	im.graphiteCfg = bridgeCfg
	return nil
}
