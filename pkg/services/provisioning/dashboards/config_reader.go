package dashboards

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	yaml "gopkg.in/yaml.v2"
)

type configReader struct {
	path string
	log  log.Logger
}

func (cr *configReader) parseConfigs(file os.FileInfo) ([]*DashboardsAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(cr.path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	apiVersion := &ConfigVersion{ApiVersion: 0}

	// We ignore the error here because it errors out for version 0 which does not have apiVersion
	// specified (so 0 is default). This can also error in case the apiVersion is not an integer but at the moment
	// this does not handle that case and would still go on as if version = 0.
	// TODO: return appropriate error in case the apiVersion is specified but isn't integer (or even if it is
	//  integer > max version?).
	_ = yaml.Unmarshal(yamlFile, &apiVersion)

	if apiVersion.ApiVersion > 0 {
		v1 := &DashboardAsConfigV1{}
		err := yaml.Unmarshal(yamlFile, &v1)
		if err != nil {
			return nil, err
		}

		if v1 != nil {
			return v1.mapToDashboardAsConfig(), nil
		}
	} else {
		var v0 []*DashboardsAsConfigV0
		err := yaml.Unmarshal(yamlFile, &v0)
		if err != nil {
			return nil, err
		}

		if v0 != nil {
			cr.log.Warn("[Deprecated] the dashboard provisioning config is outdated. please upgrade", "filename", filename)
			return mapV0ToDashboardAsConfig(v0), nil
		}
	}

	return []*DashboardsAsConfig{}, nil
}

func (cr *configReader) readConfig() ([]*DashboardsAsConfig, error) {
	var dashboards []*DashboardsAsConfig

	files, err := ioutil.ReadDir(cr.path)
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
		if dashboard.OrgId == 0 {
			dashboard.OrgId = 1
		}

		if dashboard.UpdateIntervalSeconds == 0 {
			dashboard.UpdateIntervalSeconds = 10
		}
		if len(dashboard.FolderUid) > 0 {
			uidUsage[dashboard.FolderUid] += 1
		}
	}

	for uid, times := range uidUsage {
		if times > 1 {
			cr.log.Error("the same 'folderUid' is used more than once", "folderUid", uid)
		}
	}

	return dashboards, nil
}
