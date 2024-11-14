package dashboards

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
)

type configReader struct {
	path       string
	log        log.Logger
	orgService org.Service
}

func (cr *configReader) parseConfigs(file fs.DirEntry) ([]*config, error) {
	filename, _ := filepath.Abs(filepath.Join(cr.path, file.Name()))

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	apiVersion := &configVersion{APIVersion: 0}

	// We ignore the error here because it errors out for version 0 which does not have apiVersion
	// specified (so 0 is default). This can also error in case the apiVersion is not an integer but at the moment
	// this does not handle that case and would still go on as if version = 0.
	// TODO: return appropriate error in case the apiVersion is specified but isn't integer (or even if it is
	//  integer > max version?).
	_ = yaml.Unmarshal(yamlFile, &apiVersion)

	if apiVersion.APIVersion > 0 {
		v1 := &configV1{}
		err := yaml.Unmarshal(yamlFile, &v1)
		if err != nil {
			return nil, err
		}

		if v1 != nil {
			return v1.mapToDashboardsAsConfig()
		}
	} else {
		var v0 []*configV0
		err := yaml.Unmarshal(yamlFile, &v0)
		if err != nil {
			return nil, err
		}

		if v0 != nil {
			cr.log.Warn("[Deprecated] the dashboard provisioning config is outdated. please upgrade", "filename", filename)
			return mapV0ToDashboardsAsConfig(v0)
		}
	}

	return []*config{}, nil
}

func (cr *configReader) readConfig(ctx context.Context) ([]*config, error) {
	var dashboards []*config

	files, err := os.ReadDir(cr.path)
	if err != nil {
		cr.log.Error("can't read dashboard provisioning files from directory", "path", cr.path, "error", err)
		return dashboards, nil
	}

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".yaml") && !strings.HasSuffix(file.Name(), ".yml") {
			continue
		}

		parsedDashboards, err := cr.parseConfigs(file)
		if err != nil {
			return nil, fmt.Errorf("could not parse provisioning config file: %s error: %v", file.Name(), err)
		}

		if len(parsedDashboards) > 0 {
			dashboards = append(dashboards, parsedDashboards...)
		}
	}

	uidUsage := map[string]uint8{}
	for _, dashboard := range dashboards {
		if dashboard.OrgID == 0 {
			dashboard.OrgID = 1
		}

		if err := utils.CheckOrgExists(ctx, cr.orgService, dashboard.OrgID); err != nil {
			return nil, fmt.Errorf("failed to provision dashboards with %q reader: %w", dashboard.Name, err)
		}

		if dashboard.Type == "" {
			dashboard.Type = "file"
		}

		if dashboard.UpdateIntervalSeconds == 0 {
			dashboard.UpdateIntervalSeconds = 10
		}
		if len(dashboard.FolderUID) > 0 {
			uidUsage[dashboard.FolderUID]++
		}
	}

	for uid, times := range uidUsage {
		if times > 1 {
			cr.log.Error("the same folder UID is used more than once", "folderUid", uid)
		}
	}

	return dashboards, nil
}
