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

var CmdCreateAccount = cli.Command{
	Name:        "account:create",
	Usage:       "create a new account",
	Description: "Creates a new account",
	Action:      createAccount,
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

func createAccount(c *cli.Context) {
	setting.NewConfigContext()
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()

	if !c.Args().Present() {
		fmt.Printf("Account name arg is required\n")
		return
	}

	name := c.Args().First()

	adminQuery := m.GetUserByLoginQuery{LoginOrEmail: setting.AdminUser}

	if err := bus.Dispatch(&adminQuery); err == m.ErrUserNotFound {
		log.Error(3, "Failed to find default admin user", err)
		return
	}

	adminUser := adminQuery.Result

	cmd := m.CreateAccountCommand{Name: name, UserId: adminUser.Id}
	if err := bus.Dispatch(&cmd); err != nil {
		log.Error(3, "Failed to create account", err)
		return
	}
	fmt.Printf("Account %s created for admin user %s\n", name, adminUser.Email)
}
