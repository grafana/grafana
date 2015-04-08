package cmd

import (
	"time"

	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func initRuntime(c *cli.Context) {
	var args = &setting.CommandLineArgs{
		Config:          c.GlobalString("config"),
		DefaultDataPath: c.GlobalString("default-data-path"),
		DefaultLogPath:  c.GlobalString("default-log-path"),
	}

	setting.NewConfigContext(args)

	log.Info("Starting Grafana")
	log.Info("Version: %v, Commit: %v, Build date: %v", setting.BuildVersion, setting.BuildCommit, time.Unix(setting.BuildStamp, 0))
	setting.LogLoadedConfigFiles()

	log.Info("Working Path: %s", setting.WorkPath)
	log.Info("Data Path: %s", setting.DataPath)
	log.Info("Log Path: %s", setting.LogRootPath)

	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()
}
