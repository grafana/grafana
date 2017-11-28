package provisioning

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/provisioning/dashboard"
	"github.com/grafana/grafana/pkg/services/provisioning/datasource"
	ini "gopkg.in/ini.v1"
)

func Init(ctx context.Context, homePath string, cfg *ini.File) error {
	datasourcePath := makeAbsolute(cfg.Section("paths").Key("datasources").String(), homePath)
	if err := datasource.Provision(datasourcePath); err != nil {
		return err
	}

	dashboardPath := makeAbsolute(cfg.Section("paths").Key("dashboards").String(), homePath)
	_, err := dashboard.Provision(ctx, dashboardPath)
	if err != nil {
		return err
	}

	return nil
}

func makeAbsolute(path string, root string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(root, path)
}
