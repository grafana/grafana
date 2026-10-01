package builder

import (
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

// A process builds a handler chain per server against one registry, so both
// must register and stay apart in the scrape.
func TestNewWatchMetrics_PerServer(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()

	main := newWatchMetrics(ServerRegisterer(reg, ServerMain))
	apiExtensions := newWatchMetrics(ServerRegisterer(reg, ServerAPIExtensions))

	main.observeEstablishment("dashboard.grafana.app", "dashboards", time.Second)
	apiExtensions.observeEstablishment("example.grafana.app", "widgets", time.Second)

	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP grafana_apiserver_watch_establishment_duration_seconds Time from receiving a watch request to the first byte written to the client, by server, group and resource.
# TYPE grafana_apiserver_watch_establishment_duration_seconds histogram
grafana_apiserver_watch_establishment_duration_seconds_sum{group="dashboard.grafana.app",resource="dashboards",server="main"} 1
grafana_apiserver_watch_establishment_duration_seconds_count{group="dashboard.grafana.app",resource="dashboards",server="main"} 1
grafana_apiserver_watch_establishment_duration_seconds_sum{group="example.grafana.app",resource="widgets",server="apiextensions"} 1
grafana_apiserver_watch_establishment_duration_seconds_count{group="example.grafana.app",resource="widgets",server="apiextensions"} 1
`), "grafana_apiserver_watch_establishment_duration_seconds_sum",
		"grafana_apiserver_watch_establishment_duration_seconds_count"))
}

// A nil registerer leaves the collectors unregistered rather than panicking.
func TestNewWatchMetrics_NilRegisterer(t *testing.T) {
	m := newWatchMetrics(ServerRegisterer(nil, ServerMain))
	require.NotPanics(t, func() { m.observeEstablishment("g", "r", time.Second) })
}

func TestNewWatchMetrics_ReusesRegisteredCollector(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	first := newWatchMetrics(ServerRegisterer(reg, ServerMain))
	second := newWatchMetrics(ServerRegisterer(reg, ServerMain))
	require.Same(t, first.establishmentDuration, second.establishmentDuration)
	first.observeEstablishment("one", "things", time.Second)
	second.observeEstablishment("two", "things", time.Second)
	metrics, err := reg.Gather()
	require.NoError(t, err)
	require.Len(t, metrics, 1)
	require.Len(t, metrics[0].Metric, 2)
}
