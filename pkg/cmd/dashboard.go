package cmd

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

var (
	ImportDashboard = cli.Command{
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

	ExportDashboard = cli.Command{
		Name:        "dashboards:export",
		Usage:       "exports dashboards in JSON from a directory",
		Description: "Starts Grafana export process",
		Action:      runExport,
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "dir",
				Usage: "path to folder containing json dashboards",
			},
		},
	}
)

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

func runExport(c *cli.Context) {
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

	dir := c.String("dir")
	dash := c.Args().Get(1)

	query := m.SearchDashboardsQuery{OrgId: orgId, Title: dash}
	err := bus.Dispatch(&query)
	if err != nil {
		log.ConsoleFatalf("Failed to find dashboards: %s", err)
		return
	}

	if dir == "" && len(query.Result) > 1 {
		log.ConsoleFatalf("Dashboard title '%s' returned too many results. "+
			"Use --dir <dir> or a more specific title", dash)
		return
	}

	for _, v := range query.Result {
		f := os.Stdout
		if dir != "" {
			dest := filepath.Join(dir, v.Slug+".json")
			f, err = os.Create(dest)
			if err != nil {
				log.ConsoleFatalf("Unable to create file: %s", err)
			}
			log.ConsoleInfof("Exporting '%s' dashboard to %s", v.Title, dest)
		}

		exportDashboard(f, orgId, v.Slug)

		if dir != "" {
			if err := f.Sync(); err != nil {
				log.ConsoleFatalf("Unable to sync file: %s", err)
			}

			if err := f.Close(); err != nil {
				log.ConsoleFatalf("Unable to close file: %s", err)
			}
		}
	}
	if dir != "" {
		log.ConsoleInfof("Exported %d dashboards to %s", len(query.Result), dir)
	}
}

func exportDashboard(w io.Writer, orgId int64, slug string) {
	query := m.GetDashboardQuery{Slug: slug, OrgId: orgId}
	err := bus.Dispatch(&query)
	if err != nil {
		log.ConsoleFatalf("Failed to find dashboard: %s", err)
		return
	}

	out, err := json.MarshalIndent(query.Result.Data, "", "  ")
	if err != nil {
		log.ConsoleFatalf("Failed to marshal dashboard: %s", err)
		return
	}

	n, err := w.Write(out)
	if err != nil {
		log.ConsoleFatalf("Failed to write dashboard: %s", err)
		return
	}

	if n != len(out) {
		log.ConsoleFatalf("Failed to write dashboard: wrote %d expected %d", n, len(out))
		return
	}
}
