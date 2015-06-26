package main

import (
	"flag"
	"io/ioutil"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"github.com/Dieterbe/profiletrigger/heap"
	"github.com/Dieterbe/statsd-go"
	"github.com/grafana/grafana/pkg/alerting"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/cmd"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/elasticstore"
	"github.com/grafana/grafana/pkg/services/eventpublisher"
	"github.com/grafana/grafana/pkg/services/metricpublisher"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/search"
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

	if setting.ProfileHeapMB > 0 {
		errors := make(chan error)
		go func() {
			for e := range errors {
				// TODO: skip arg should be documented and corrected if neccesary.
				log.Error(0, e.Error())
			}
		}()
		heap, _ := heap.New(setting.ProfileHeapDir, setting.ProfileHeapMB, setting.ProfileHeapWait, time.Duration(1)*time.Second, errors)
		go heap.Run()
	}

	search.Init()
	social.NewOAuthService()
	eventpublisher.Init()
	plugins.Init()
	metricpublisher.Init()
	elasticstore.Init()
	api.InitCollectorController()

	s, err := statsd.NewClient(setting.StatsdEnabled, setting.StatsdAddr, "grafana")
	if err != nil {
		log.Error(3, "Statsd client:", err)
	}
	// for now only alerting uses statsd, but soon other packages will too.
	alerting.Stat = s

	alerting.Construct()

	if err := notifications.Init(); err != nil {
		log.Fatal(3, "Notification service failed to initialize", err)
	}

	if setting.ReportingEnabled {
		go metrics.StartUsageReportLoop()
	}

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
