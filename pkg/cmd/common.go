package cmd

import (
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func initRuntime(c *cli.Context) {
	setting.NewConfigContext(c.GlobalString("config"))
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()
}
