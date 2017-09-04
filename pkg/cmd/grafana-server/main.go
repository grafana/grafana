package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"runtime/trace"
	"strconv"
	"syscall"
	"time"

	"net/http"
	_ "net/http/pprof"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"

	_ "github.com/grafana/grafana/pkg/services/alerting/conditions"
	_ "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
	_ "github.com/grafana/grafana/pkg/tsdb/influxdb"
	_ "github.com/grafana/grafana/pkg/tsdb/mqe"
	_ "github.com/grafana/grafana/pkg/tsdb/mysql"
	_ "github.com/grafana/grafana/pkg/tsdb/opentsdb"
	_ "github.com/grafana/grafana/pkg/tsdb/prometheus"
	_ "github.com/grafana/grafana/pkg/tsdb/testdata"
)

var version = "4.1.0"
var commit = "NA"
var buildstamp string
var build_date string

var configFile = flag.String("config", "", "path to config file")
var homePath = flag.String("homepath", "", "path to grafana install/home path, defaults to working directory")
var pidFile = flag.String("pidfile", "", "path to pid file")
var exitChan = make(chan int)

func init() {
}

func main() {
	v := flag.Bool("v", false, "prints current version and exits")
	profile := flag.Bool("profile", false, "Turn on pprof profiling")
	profilePort := flag.Int("profile-port", 6060, "Define custom port for profiling")
	flag.Parse()
	if *v {
		fmt.Printf("Version %s (commit: %s)\n", version, commit)
		os.Exit(0)
	}

	if *profile {
		runtime.SetBlockProfileRate(1)
		go func() {
			http.ListenAndServe(fmt.Sprintf("localhost:%d", *profilePort), nil)
		}()

		f, err := os.Create("trace.out")
		if err != nil {
			panic(err)
		}
		defer f.Close()

		err = trace.Start(f)
		if err != nil {
			panic(err)
		}
		defer trace.Stop()
	}

	buildstampInt64, _ := strconv.ParseInt(buildstamp, 10, 64)
	if buildstampInt64 == 0 {
		buildstampInt64 = time.Now().Unix()
	}

	setting.BuildVersion = version
	setting.BuildCommit = commit
	setting.BuildStamp = buildstampInt64

	server := NewGrafanaServer()
	server.Start()
}

func initSql() {
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()
}

func listenToSystemSignals(server models.GrafanaServer) {
	signalChan := make(chan os.Signal, 1)
	ignoreChan := make(chan os.Signal, 1)
	code := 0

	signal.Notify(ignoreChan, syscall.SIGHUP)
	signal.Notify(signalChan, os.Interrupt, os.Kill, syscall.SIGTERM)

	select {
	case sig := <-signalChan:
		// Stops trace if profiling has been enabled
		trace.Stop()
		server.Shutdown(0, fmt.Sprintf("system signal: %s", sig))
	case code = <-exitChan:
		server.Shutdown(code, "startup error")
	}
}
