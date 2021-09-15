package main

import (
	"os"

<<<<<<< HEAD
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	_ "github.com/grafana/grafana/pkg/plugins/apiserver"
	"github.com/grafana/grafana/pkg/server"
	_ "github.com/grafana/grafana/pkg/services/alerting/conditions"
	_ "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	_ "github.com/grafana/grafana/pkg/services/authtoken"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	_ "github.com/grafana/grafana/pkg/tsdb/cloudmonitoring"
	_ "github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	_ "github.com/grafana/grafana/pkg/tsdb/elasticsearch"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
	_ "github.com/grafana/grafana/pkg/tsdb/influxdb"
	_ "github.com/grafana/grafana/pkg/tsdb/loki"
	_ "github.com/grafana/grafana/pkg/tsdb/mysql"
	_ "github.com/grafana/grafana/pkg/tsdb/opentsdb"
	_ "github.com/grafana/grafana/pkg/tsdb/postgres"
	_ "github.com/grafana/grafana/pkg/tsdb/prometheus"
	_ "github.com/grafana/grafana/pkg/tsdb/tempo"
	_ "github.com/grafana/grafana/pkg/tsdb/testdatasource"
=======
	"github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
>>>>>>> origin/main
)

// The following variables cannot be constants, since they can be overridden through the -X link flag
var version = "7.5.0"
var commit = "NA"
var buildBranch = "main"
var buildstamp string

func main() {
	os.Exit(commands.RunServer(commands.ServerOptions{
		Version:     version,
		Commit:      commit,
		BuildBranch: buildBranch,
		BuildStamp:  buildstamp,
	}))
}
