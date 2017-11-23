package provisioning

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboard"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	ini "gopkg.in/ini.v1"
)

var (
	logger log.Logger = log.New("services.provisioning")
)

type Provisioner struct {
	datasourcePath string
	dashboardPath  string
	bgContext      context.Context
}

func Init(backgroundContext context.Context, homePath string, cfg *ini.File) error {
	datasourcePath := makeAbsolute(cfg.Section("paths").Key("datasources").String(), homePath)
	if err := datasources.Provision(datasourcePath); err != nil {
		return err
	}

	dashboardPath := makeAbsolute(cfg.Section("paths").Key("dashboards").String(), homePath)
	_, err := dashboard.Provision(backgroundContext, dashboardPath)
	if err != nil {
		return err
	}

	return nil
}

func (p *Provisioner) Listen() error {
	return nil
}

func makeAbsolute(path string, root string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(root, path)
}
