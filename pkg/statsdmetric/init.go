// a metrics class that uses statsd on the backend
// at some point, we could/might try to unite this with the metrics package

// note that on creation, we automatically send a default value so that:
// * influxdb doesn't complain when queried for series that don't exist yet, which breaks graphs in grafana
// * the series show up in your monitoring tool of choice, so you can easily do alerting rules, build dashes etc
// without having to wait for data. some series would otherwise only be created when things go badly wrong etc.
// note that for gauges and timers this can create inaccuracies because the true values are hard to predict,
// but it's worth the trade-off.
// (for count 0 is harmless and accurate)

package statsdmetric

import (
	"github.com/Dieterbe/statsd-go"
)

var Stat, _ = statsd.NewClient(false, "", "")

func NewClient(enabled bool, addr, prefix string) error {
	client, err := statsd.NewClient(enabled, addr, prefix)
	if err == nil {
		Stat = client
	}
	return err
}
