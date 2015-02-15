package cmd

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"os"
	"text/tabwriter"
)

var ListAccounts = cli.Command{
	Name:        "account",
	Usage:       "list accounts",
	Description: "Lists the accounts in the system",
	Action:      listAccounts,
}

var CreateAccount = cli.Command{
	Name:        "account:create",
	Usage:       "create a new account",
	Description: "Creates a new account",
	Action:      createAccount,
}

var DeleteAccount = cli.Command{
	Name:        "account:delete",
	Usage:       "delete an existing account",
	Description: "Deletes an existing account",
	Action:      deleteAccount,
}

func listAccounts(c *cli.Context) {
	initRuntime(c)

	accountsQuery := m.GetAccountsQuery{}
	if err := bus.Dispatch(&accountsQuery); err != nil {
		log.ConsoleFatalf("Failed to find accounts: %s", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 8, 1, 4, ' ', 0)

	fmt.Fprintf(w, "ID\tNAME\n")
	for _, account := range accountsQuery.Result {
		fmt.Fprintf(w, "%d\t%s\n", account.Id, account.Name)
	}
	w.Flush()
}

func createAccount(c *cli.Context) {
	initRuntime(c)

	if !c.Args().Present() {
		log.ConsoleFatal("Account name arg is required")
	}

	name := c.Args().First()

	adminQuery := m.GetUserByLoginQuery{LoginOrEmail: setting.AdminUser}

	if err := bus.Dispatch(&adminQuery); err == m.ErrUserNotFound {
		log.ConsoleFatalf("Failed to find default admin user: %s", err)
	}

	adminUser := adminQuery.Result

	cmd := m.CreateAccountCommand{Name: name, UserId: adminUser.Id}
	if err := bus.Dispatch(&cmd); err != nil {
		log.ConsoleFatalf("Failed to create account: %s", err)
	}

	log.ConsoleInfof("Account %s created for admin user %s\n", name, adminUser.Email)
}

func deleteAccount(c *cli.Context) {
	initRuntime(c)

	if !c.Args().Present() {
		log.ConsoleFatal("Account name arg is required")
	}

	name := c.Args().First()
	accountQuery := m.GetAccountByNameQuery{Name: name}
	if err := bus.Dispatch(&accountQuery); err != nil {
		log.ConsoleFatalf("Failed to find account: %s", err)
	}

	accountId := accountQuery.Result.Id
	cmd := m.DeleteAccountCommand{Id: accountId}
	if err := bus.Dispatch(&cmd); err != nil {
		log.ConsoleFatalf("Failed to delete account: %s", err)
	}

	log.ConsoleInfof("Account %s deleted", name)
}
