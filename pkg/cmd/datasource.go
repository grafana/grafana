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

var (
	ListDataSources = cli.Command{
		Name:        "datasource",
		Usage:       "list datasources",
		Description: "Lists the datasources in the system",
		Action:      listDatasources,
	}
	DescribeDataSource = cli.Command{
		Name:        "datasource:info",
		Usage:       "describe the details of a datasource",
		Description: "Describes the details of a datasource",
		Action:      describeDataSource,
	}
)

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

func describeDataSource(c *cli.Context) {
	setting.NewConfigContext()
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()

	if len(c.Args()) != 2 {
		log.ConsoleFatal("Account and datasource name args are required")
	}

	name := c.Args().First()
	ds := c.Args()[1]

	accountQuery := m.GetAccountByNameQuery{Name: name}
	if err := bus.Dispatch(&accountQuery); err != nil {
		log.ConsoleFatalf("Failed to find account: %s", err)
	}

	accountId := accountQuery.Result.Id

	query := m.GetDataSourceByNameQuery{AccountId: accountId, Name: ds}
	if err := bus.Dispatch(&query); err != nil {
		log.ConsoleFatalf("Failed to find accounts: %s", err)
	}
	datasource := query.Result

	w := tabwriter.NewWriter(os.Stdout, 20, 1, 4, ' ', 0)
	fmt.Fprintf(w, "NAME\t%s\n", datasource.Name)
	fmt.Fprintf(w, "URL\t%s\n", datasource.Url)
	fmt.Fprintf(w, "DEFAULT\t%t\n", datasource.IsDefault)
	fmt.Fprintf(w, "ACCESS\t%s\n", datasource.Access)
	fmt.Fprintf(w, "TYPE\t%s\n", datasource.Type)

	switch datasource.Type {
	case m.DS_INFLUXDB:
		fmt.Fprintf(w, "DATABASE\t%s\n", datasource.Database)
		fmt.Fprintf(w, "DB USER\t%s\n", datasource.User)
		fmt.Fprintf(w, "DB PASSWORD\t%s\n", datasource.Password)
	case m.DS_ES:
		fmt.Fprintf(w, "INDEX\t%s\n", datasource.Database)
	}
	w.Flush()
}
