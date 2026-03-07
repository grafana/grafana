package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/tsdb/prometheus"
)

func main() {
	logger := backend.NewLoggerWith("logger", "tsdb.prometheus")
	if err := datasource.Manage("prometheus", prometheus.NewInstanceSettings(logger), datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
