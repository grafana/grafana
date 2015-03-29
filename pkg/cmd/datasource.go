package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

var (
	ListDataSources = cli.Command{
		Name:        "datasources",
		Usage:       "list datasources",
		Description: "Lists the datasources in the system",
		Action:      listDatasources,
	}
	CreateDataSource = cli.Command{
		Name:        "datasources:create",
		Usage:       "creates a new datasource",
		Description: "Creates a new datasource",
		Action:      createDataSource,
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "type",
				Value: "graphite",
				Usage: fmt.Sprintf("Datasource type [%s,%s,%s,%s]",
					m.DS_GRAPHITE, m.DS_INFLUXDB, m.DS_ES, m.DS_OPENTSDB),
			},
			cli.StringFlag{
				Name:  "access",
				Value: "proxy",
				Usage: "Datasource access [proxy,direct]",
			},
			cli.BoolFlag{
				Name:  "default",
				Usage: "Make this the default datasource",
			},
			cli.StringFlag{
				Name:  "db",
				Usage: "InfluxDB DB",
			},
			cli.StringFlag{
				Name:  "user",
				Usage: "InfluxDB username",
			},
			cli.StringFlag{
				Name:  "password",
				Usage: "InfluxDB password",
			},
		},
	}
	DescribeDataSource = cli.Command{
		Name:        "datasources:info",
		Usage:       "describe the details of a datasource",
		Description: "Describes the details of a datasource",
		Action:      describeDataSource,
	}
	DeleteDataSource = cli.Command{
		Name:        "datasources:delete",
		Usage:       "Deletes a datasource",
		Description: "Deletes a datasource",
		Action:      deleteDataSource,
	}
)

func createDataSource(c *cli.Context) {
	initRuntime(c)

	if len(c.Args()) != 3 {
		log.ConsoleFatal("Missing required arguments")
	}

	name := c.Args().First()
	ds := c.Args()[1]
	url := c.Args()[2]
	dsType := c.String("type")
	dsAccess := c.String("access")
	dsDefault := c.Bool("default")

	orgQuery := m.GetOrgByNameQuery{Name: name}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.ConsoleFatalf("Failed to find organization: %s", err)
	}

	orgId := orgQuery.Result.Id

	query := m.GetDataSourceByNameQuery{OrgId: orgId, Name: ds}
	if err := bus.Dispatch(&query); err != nil {
		if err != m.ErrDataSourceNotFound {
			log.ConsoleFatalf("Failed to query for existing datasource: %s", err)
		}
	}

	if query.Result.Id > 0 {
		log.ConsoleFatalf("DataSource %s already exists", ds)
	}

	cmd := m.AddDataSourceCommand{
		OrgId:     orgId,
		Name:      ds,
		Url:       url,
		Type:      dsType,
		Access:    m.DsAccess(dsAccess),
		IsDefault: dsDefault,
	}

	switch dsType {
	case m.DS_INFLUXDB:
		db := c.String("db")
		if db == "" {
			log.ConsoleFatal("db name is required for influxdb datasources")
		}
		cmd.Database = db
		cmd.User = c.String("user")
		cmd.Password = c.String("password")
	}

	if err := bus.Dispatch(&cmd); err != nil {
		log.ConsoleFatalf("Failed to create datasource: %s", err)
	}
	datasource := cmd.Result

	log.ConsoleInfof("Datasource %s created", datasource.Name)
}

func listDatasources(c *cli.Context) {
	initRuntime(c)

	if !c.Args().Present() {
		log.ConsoleFatal("Account name arg is required")
	}

	name := c.Args().First()
	orgQuery := m.GetOrgByNameQuery{Name: name}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.ConsoleFatalf("Failed to find organization: %s", err)
	}

	orgId := orgQuery.Result.Id

	query := m.GetDataSourcesQuery{OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		log.ConsoleFatalf("Failed to find datasources: %s", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 8, 1, 4, ' ', 0)

	fmt.Fprintf(w, "ID\tNAME\tURL\tTYPE\tACCESS\tDEFAULT\n")
	for _, ds := range query.Result {
		fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\t%t\n", ds.Id, ds.Name, ds.Url, ds.Type,
			ds.Access, ds.IsDefault)
	}
	w.Flush()
}

func describeDataSource(c *cli.Context) {
	initRuntime(c)

	if len(c.Args()) != 2 {
		log.ConsoleFatal("Organization and datasource name args are required")
	}

	name := c.Args().First()
	ds := c.Args()[1]

	orgQuery := m.GetOrgByNameQuery{Name: name}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.ConsoleFatalf("Failed to find organization: %s", err)
	}

	orgId := orgQuery.Result.Id

	query := m.GetDataSourceByNameQuery{OrgId: orgId, Name: ds}
	if err := bus.Dispatch(&query); err != nil {
		log.ConsoleFatalf("Failed to find datasource: %s", err)
	}
	datasource := query.Result

	w := tabwriter.NewWriter(os.Stdout, 8, 1, 4, ' ', 0)
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

func deleteDataSource(c *cli.Context) {
	initRuntime(c)

	if len(c.Args()) != 2 {
		log.ConsoleFatal("Account and datasource name args are required")
	}

	name := c.Args().First()
	ds := c.Args()[1]

	orgQuery := m.GetOrgByNameQuery{Name: name}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.ConsoleFatalf("Failed to find organization: %s", err)
	}

	orgId := orgQuery.Result.Id

	query := m.GetDataSourceByNameQuery{OrgId: orgId, Name: ds}
	if err := bus.Dispatch(&query); err != nil {
		log.ConsoleFatalf("Failed to find datasource: %s", err)
	}
	datasource := query.Result

	cmd := m.DeleteDataSourceCommand{OrgId: orgId, Id: datasource.Id}
	if err := bus.Dispatch(&cmd); err != nil {
		log.ConsoleFatalf("Failed to delete datasource: %s", err)
	}

	log.ConsoleInfof("DataSource %s deleted", ds)
}
