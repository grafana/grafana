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
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var ImportJson = cli.Command{
	Name:        "dashboard:import",
	Usage:       "imports dashboards in JSON from a directory",
	Description: "Starts Grafana import process",
	Action:      runImport,
	Flags: []cli.Flag{
		cli.StringFlag{
			Name:  "dir",
			Usage: "path to folder containing json dashboards",
		},
		cli.StringFlag{
			Name:  "account",
			Usage: "Account name to save dashboards under",
		},
	},
}

func runImport(c *cli.Context) {
	dir := c.String("dir")
	if len(dir) == 0 {
		log.Error(3, "Missing command flag --dir")
		return
	}

	file, err := os.Stat(dir)
	if os.IsNotExist(err) {
		log.Error(3, "Directory does not exist: %v", dir)
		return
	}

	if !file.IsDir() {
		log.Error(3, "%v is not a directory", dir)
		return
	}

	accountName := c.String("account")
	if len(accountName) == 0 {
		log.Error(3, "Missing command flag --account")
		return
	}

	setting.NewConfigContext()
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()

	accountQuery := m.GetAccountByNameQuery{Name: accountName}
	if err := bus.Dispatch(&accountQuery); err != nil {
		log.Error(3, "Failed to find account", err)
		return
	}

	accountId := accountQuery.Result.Id

	visitor := func(path string, f os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if f.IsDir() {
			return nil
		}
		if strings.HasSuffix(f.Name(), ".json") {
			if err := importDashboard(path, accountId); err != nil {
				log.Error(3, "Failed to import dashboard file: %v,  err: %v", path, err)
			}
		}
		return nil
	}

	if err := filepath.Walk(dir, visitor); err != nil {
		log.Error(3, "failed to scan dir for json files: %v", err)
	}
}

func importDashboard(path string, accountId int64) error {
	log.Info("Importing %v", path)

	reader, err := os.Open(path)
	if err != nil {
		return err
	}

	dash := m.NewDashboard("temp")
	jsonParser := json.NewDecoder(reader)

	if err := jsonParser.Decode(&dash.Data); err != nil {
		return err
	}
	dash.Data["id"] = nil

	cmd := m.SaveDashboardCommand{
		AccountId: accountId,
		Dashboard: dash.Data,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return err
	}

	return nil
}
