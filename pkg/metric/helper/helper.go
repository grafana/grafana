package helper

import (
	"fmt"

	"github.com/grafana/grafana/pkg/metric"
	"github.com/grafana/grafana/pkg/metric/dogstatsd"
	"github.com/grafana/grafana/pkg/metric/statsd"
)

func New(enabled bool, addr, t, service, instance string) (metric.Backend, error) {
	if t != "standard" && t != "datadog" {
		panic(fmt.Sprintf("unrecognized statsd type: '%s'", t))
	}
	if !enabled {
		// we could implement a true "null-backend"
		// but since statsd supports disabled mode, this is easier
		return statsd.New(enabled, addr, "")
	}
	if t == "standard" {
		return statsd.New(enabled, addr, fmt.Sprintf("%s.%s.", service, instance))
	} else {
		return dogstatsd.New(addr, service+".", []string{"instance:" + instance})
	}
}
