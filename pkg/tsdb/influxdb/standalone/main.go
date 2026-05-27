package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	influxdb "github.com/grafana/grafana/pkg/tsdb/influxdb"
)

func main() {
	if err := datasource.Manage("influxdb", influxdb.NewInstanceSettings(httpclient.NewProvider()), datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
