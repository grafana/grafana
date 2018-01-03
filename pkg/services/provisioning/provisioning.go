package provisioning

import (
	"context"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	ini "gopkg.in/ini.v1"
)

func Init(ctx context.Context, homePath string, cfg *ini.File) error {
	provisioningPath := makeAbsolute(cfg.Section("paths").Key("provisioning").String(), homePath)

	datasourcePath := path.Join(provisioningPath, "datasources")
	if err := datasources.Provision(datasourcePath); err != nil {
		return err
	}

	dashboardPath := path.Join(provisioningPath, "dashboards")
	_, err := dashboards.Provision(ctx, dashboardPath)
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
