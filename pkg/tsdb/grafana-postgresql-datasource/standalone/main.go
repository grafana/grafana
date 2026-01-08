package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	postgres "github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource"
)

func main() {
	// No need to pass logger name, it will be set by the plugin SDK
	logger := backend.NewLoggerWith()
	if err := datasource.Manage("grafana-postgresql-datasource", postgres.NewInstanceSettings(logger), datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
