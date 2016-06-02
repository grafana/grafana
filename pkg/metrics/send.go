package metrics

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics/senders"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type MetricSender interface {
	Send(metrics map[string]interface{}) error
}

func StartUsageReportLoop() chan struct{} {
	M_Instance_Start.Inc(1)

	hourTicker := time.NewTicker(time.Hour * 24)
	secondTicker := time.NewTicker(time.Second * 10)

	sender := &receiver.GraphiteSender{
		Host:     "localhost",
		Port:     "2003",
		Protocol: "tcp",
		Prefix:   "grafana.",
	}

	for {
		select {
		case <-hourTicker.C:
			sendUsageStats()
		case <-secondTicker.C:
			sendMetricUsage(sender)
		}
	}
}

func sendMetricUsage(sender MetricSender) {
	metrics := map[string]interface{}{}

	MetricStats.Each(func(name string, i interface{}) {
		switch metric := i.(type) {
		case Counter:
			if metric.Count() > 0 {
				metrics[name+".count"] = metric.Count()
				metric.Clear()
			}
		case Timer:
			if metric.Total() > 0 {
				metrics[name+".avg"] = metric.Avg()
				metrics[name+".min"] = metric.Min()
				metrics[name+".max"] = metric.Max()
				metrics[name+".total"] = metric.Total()
				metric.Clear()
			}
		}
	})

	err := sender.Send(metrics)
	if err != nil {
		log.Error(1, "Failed to send metrics:", err)
	}
}

func sendUsageStats() {
	log.Trace("Sending anonymous usage stats to stats.grafana.org")

	version := strings.Replace(setting.BuildVersion, ".", "_", -1)

	metrics := map[string]interface{}{}
	report := map[string]interface{}{
		"version": version,
		"metrics": metrics,
	}

	UsageStats.Each(func(name string, i interface{}) {
		switch metric := i.(type) {
		case Counter:
			if metric.Count() > 0 {
				metrics[name+".count"] = metric.Count()
				metric.Clear()
			}
		}
	})

	statsQuery := m.GetSystemStatsQuery{}
	if err := bus.Dispatch(&statsQuery); err != nil {
		log.Error(3, "Failed to get system stats", err)
		return
	}

	metrics["stats.dashboards.count"] = statsQuery.Result.DashboardCount
	metrics["stats.users.count"] = statsQuery.Result.UserCount
	metrics["stats.orgs.count"] = statsQuery.Result.OrgCount
	metrics["stats.playlist.count"] = statsQuery.Result.PlaylistCount
	metrics["stats.plugins.apps.count"] = len(plugins.Apps)
	metrics["stats.plugins.panels.count"] = len(plugins.Panels)
	metrics["stats.plugins.datasources.count"] = len(plugins.DataSources)

	dsStats := m.GetDataSourceStatsQuery{}
	if err := bus.Dispatch(&dsStats); err != nil {
		log.Error(3, "Failed to get datasource stats", err)
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
