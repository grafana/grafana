package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"github.com/Dieterbe/statsd-go"
	"github.com/grafana/grafana/pkg/alerting"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/cmd"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/search"
	"github.com/grafana/grafana/pkg/services/elasticstore"
	"github.com/grafana/grafana/pkg/services/eventpublisher"
	"github.com/grafana/grafana/pkg/services/metricpublisher"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
)

var version = "master"
var commit = "NA"
var buildstamp string

var configFile = flag.String("config", "", "path to config file")
var homePath = flag.String("homepath", "", "path to grafana install/home path, defaults to working directory")
var pidFile = flag.String("pidfile", "", "path to pid file")

var Stat statsd.Client

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}

func main() {
	buildstampInt64, _ := strconv.ParseInt(buildstamp, 10, 64)

	setting.BuildVersion = version
	setting.BuildCommit = commit
	setting.BuildStamp = buildstampInt64

	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt)
		<-c
		os.Exit(0)
	}()

	flag.Parse()

	writePIDFile()
	initRuntime()

	fmt.Println("creating statsdclient. enabled", setting.StatsdEnabled, "addr", setting.StatsdAddr)
	//Stat, err := statsd.NewClient(setting.StatsdEnabled, setting.StatsdAddr, "grafana")
	// TODO: properly do config
	// keep getting: [setting.go:267 loadSpecifedConfigFile()] [E] Unknown config section telemetry defined in /etc/grafana/custom.ini)
	Stat, err := statsd.NewClient(true, "statsdaemon:8125", "grafana.")
	if err != nil {
		log.Error(3, "Statsd client:", err)
	}

	search.Init()
	social.NewOAuthService()
	eventpublisher.Init()
	plugins.Init()
	metricpublisher.Init()
	elasticstore.Init()
	api.InitCollectorController()

	if setting.ReportingEnabled {
		go metrics.StartUsageReportLoop()
	}
	alerting.Init(Stat)
	go alerting.Dispatcher()
	go alerting.Executor(alerting.GraphiteAuthContextReturner)

	cmd.StartServer()

	log.Close()
}

func initRuntime() {
	setting.NewConfigContext(&setting.CommandLineArgs{
		Config:   *configFile,
		HomePath: *homePath,
		Args:     flag.Args(),
	})

	log.Info("Starting Grafana")
	log.Info("Version: %v, Commit: %v, Build date: %v", setting.BuildVersion, setting.BuildCommit, time.Unix(setting.BuildStamp, 0))
	setting.LogConfigurationInfo()

	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()
}

func writePIDFile() {
	if *pidFile == "" {
		return
	}

	// Ensure the required directory structure exists.
	err := os.MkdirAll(filepath.Dir(*pidFile), 0700)
	if err != nil {
		log.Fatal(3, "Failed to verify pid directory", err)
	}

	// Retrieve the PID and write it.
	pid := strconv.Itoa(os.Getpid())
	if err := ioutil.WriteFile(*pidFile, []byte(pid), 0644); err != nil {
		log.Fatal(3, "Failed to write pidfile", err)
	}
}
