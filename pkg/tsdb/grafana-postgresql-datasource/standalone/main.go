package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	postgres "github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource"
)

func main() {
	// No need to pass logger name, it will be set by the plugin SDK
	logger := backend.NewLoggerWith()
	// TODO: get rid of setting.NewCfg() and featuremgmt.FeatureToggles once PostgresDSUsePGX is removed
	cfg := setting.NewCfg()
	// We want to enable the feature toggle for api server
	features := featuremgmt.WithFeatures(featuremgmt.FlagPostgresDSUsePGX)
	if err := datasource.Manage("grafana-postgresql-datasource", postgres.NewInstanceSettings(logger, features, cfg.DataPath), datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
