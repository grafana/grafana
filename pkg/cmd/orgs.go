package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/codegangsta/cli"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var ListOrgs = cli.Command{
	Name:        "orgs",
	Usage:       "list organizations",
	Description: "Lists the organizations in the system",
	Action:      listOrgs,
}

var CreateOrg = cli.Command{
	Name:        "orgs:create",
	Usage:       "Creates a new organization",
	Description: "Creates a new organization",
	Action:      createOrg,
}

var DeleteOrg = cli.Command{
	Name:        "orgs:delete",
	Usage:       "Delete an existing organization",
	Description: "Deletes an existing organization",
	Action:      deleteOrg,
}

func listOrgs(c *cli.Context) {
	initRuntime(c)

	orgsQuery := m.GetOrgListQuery{}
	if err := bus.Dispatch(&orgsQuery); err != nil {
		log.ConsoleFatalf("Failed to find organizations: %s", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 8, 1, 4, ' ', 0)

	fmt.Fprintf(w, "ID\tNAME\n")
	for _, org := range orgsQuery.Result {
		fmt.Fprintf(w, "%d\t%s\n", org.Id, org.Name)
	}
	w.Flush()
}

func createOrg(c *cli.Context) {
	initRuntime(c)

	if !c.Args().Present() {
		log.ConsoleFatal("Organization name arg is required")
	}

	name := c.Args().First()

	adminQuery := m.GetUserByLoginQuery{LoginOrEmail: setting.AdminUser}

	if err := bus.Dispatch(&adminQuery); err == m.ErrUserNotFound {
		log.ConsoleFatalf("Failed to find default admin user: %s", err)
	}

	adminUser := adminQuery.Result

	cmd := m.CreateOrgCommand{Name: name, UserId: adminUser.Id}
	if err := bus.Dispatch(&cmd); err != nil {
		log.ConsoleFatalf("Failed to create organization: %s", err)
	}

	log.ConsoleInfof("Organization %s created for admin user %s\n", name, adminUser.Email)
}

func deleteOrg(c *cli.Context) {
	initRuntime(c)

	if !c.Args().Present() {
		log.ConsoleFatal("Organization name arg is required")
	}

	name := c.Args().First()
	orgQuery := m.GetOrgByNameQuery{Name: name}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.ConsoleFatalf("Failed to find organization: %s", err)
	}

	orgId := orgQuery.Result.Id
	cmd := m.DeleteOrgCommand{Id: orgId}
	if err := bus.Dispatch(&cmd); err != nil {
		log.ConsoleFatalf("Failed to delete organization: %s", err)
	}

	log.ConsoleInfof("Organization %s deleted", name)
}
