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

var CmdListAccounts = cli.Command{
	Name:        "account",
	Usage:       "list accounts",
	Description: "Lists the accounts in the system",
	Action:      listAccounts,
	Flags: []cli.Flag{
		cli.StringFlag{
			Name:  "config",
			Value: "grafana.ini",
			Usage: "path to config file",
		},
	},
}

func listAccounts(c *cli.Context) {
	setting.NewConfigContext()
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()

	accountsQuery := m.GetAccountsQuery{}
	if err := bus.Dispatch(&accountsQuery); err != nil {
		log.Error(3, "Failed to find accounts", err)
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 20, 1, 4, ' ', 0)

	fmt.Fprintf(w, "ID\tNAME\n")
	for _, account := range accountsQuery.Result {
		fmt.Fprintf(w, "%d\t%s\n", account.Id, account.Name)
	}
	w.Flush()
}
