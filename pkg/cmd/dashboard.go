package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

var ImportDashboard = cli.Command{
	Name:        "dashboards:import",
	Usage:       "imports dashboards in JSON from a directory",
	Description: "Starts Grafana import process",
	Action:      runImport,
	Flags: []cli.Flag{
		cli.StringFlag{
			Name:  "dir",
			Usage: "path to folder containing json dashboards",
		},
	},
}

func runImport(c *cli.Context) {
	dir := c.String("dir")
	if len(dir) == 0 {
		log.ConsoleFatalf("Missing command flag --dir")
	}

	file, err := os.Stat(dir)
	if os.IsNotExist(err) {
		log.ConsoleFatalf("Directory does not exist: %v", dir)
	}

	if !file.IsDir() {
		log.ConsoleFatalf("%v is not a directory", dir)
	}

	if !c.Args().Present() {
		log.ConsoleFatal("Organization name arg is required")
	}

	orgName := c.Args().First()

	initRuntime(c)

	orgQuery := m.GetOrgByNameQuery{Name: orgName}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.ConsoleFatalf("Failed to find account", err)
	}

	orgId := orgQuery.Result.Id

	visitor := func(path string, f os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if f.IsDir() {
			return nil
		}
		if strings.HasSuffix(f.Name(), ".json") {
			if err := importDashboard(path, orgId); err != nil {
				log.ConsoleFatalf("Failed to import dashboard file: %v,  err: %v", path, err)
			}
		}
		return nil
	}

	if err := filepath.Walk(dir, visitor); err != nil {
		log.ConsoleFatalf("Failed to scan dir for json files: %v", err)
	}
}

func importDashboard(path string, orgId int64) error {
	log.ConsoleInfof("Importing %v", path)

	reader, err := os.Open(path)
	if err != nil {
		return err
	}

	defer reader.Close()

	dash := m.NewDashboard("temp")
	jsonParser := json.NewDecoder(reader)

	if err := jsonParser.Decode(&dash.Data); err != nil {
		return err
	}
	dash.Data["id"] = nil

	cmd := m.SaveDashboardCommand{
		OrgId:     orgId,
		Dashboard: dash.Data,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return err
	}

	return nil
}
