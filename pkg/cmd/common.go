package cmd

import (
	"time"

	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func initRuntime(c *cli.Context) {
	setting.NewConfigContext(c.GlobalString("config"))

	log.Info("Starting Grafana")
	log.Info("Version: %v, Commit: %v, Build date: %v", setting.BuildVersion, setting.BuildCommit, time.Unix(setting.BuildStamp, 0))
	setting.LogLoadedConfigFiles()

	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()
}
