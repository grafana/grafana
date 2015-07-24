package helper

import (
	"fmt"

	"github.com/grafana/grafana/pkg/metric"
	"github.com/grafana/grafana/pkg/metric/dogstatsd"
	"github.com/grafana/grafana/pkg/metric/statsd"
)

func New(enabled bool, addr, t, prefix string) (metric.Backend, error) {
	if t != "standard" && t != "datadog" {
		panic(fmt.Sprintf("unrecognized statsd type: '%s'", t))
	}
	if !enabled {
		// we could implement a true "null-backend"
		// but since statsd supports disabled mode, this is easier
		return statsd.New(enabled, addr, prefix)
	}
	if t == "standard" {
		return statsd.New(enabled, addr, prefix)
	} else {
		return dogstatsd.New(addr, prefix)
	}
}
