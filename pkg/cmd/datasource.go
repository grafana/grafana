package cmd

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"os"
	"text/tabwriter"
)

var ListDataSources = cli.Command{
	Name:        "datasource",
	Usage:       "list datasources",
	Description: "Lists the datasources in the system",
	Action:      listDatasources,
	Flags: []cli.Flag{
		cli.StringFlag{
			Name:  "config",
			Value: "grafana.ini",
			Usage: "path to config file",
		},
	},
}

func listDatasources(c *cli.Context) {
	setting.NewConfigContext()
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()

	if !c.Args().Present() {
		log.ConsoleFatal("Account name arg is required")
	}

	name := c.Args().First()
	accountQuery := m.GetAccountByNameQuery{Name: name}
	if err := bus.Dispatch(&accountQuery); err != nil {
		log.ConsoleFatalf("Failed to find account: %s", err)
	}

	accountId := accountQuery.Result.Id

	query := m.GetDataSourcesQuery{AccountId: accountId}
	if err := bus.Dispatch(&query); err != nil {
		log.ConsoleFatalf("Failed to find datasources: %s", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 20, 1, 4, ' ', 0)

	fmt.Fprintf(w, "ID\tNAME\tURL\tTYPE\tACCESS\tDEFAULT\n")
	for _, ds := range query.Result {
		fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\t%t\n", ds.Id, ds.Name, ds.Url, ds.Type,
			ds.Access, ds.IsDefault)
	}
	w.Flush()
}
