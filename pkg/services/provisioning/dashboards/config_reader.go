package dashboards

import (
	"io/ioutil"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	yaml "gopkg.in/yaml.v2"
)

type configReader struct {
	path string
	log  log.Logger
}

func (cr *configReader) readConfig() ([]*DashboardsAsConfig, error) {
	var dashboards []*DashboardsAsConfig

	files, err := ioutil.ReadDir(cr.path)

	if err != nil {
		cr.log.Error("cant read dashboard provisioning files from directory", "path", cr.path)
		return dashboards, nil
	}

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".yaml") && !strings.HasSuffix(file.Name(), ".yml") {
			continue
		}

		filename, _ := filepath.Abs(filepath.Join(cr.path, file.Name()))
		yamlFile, err := ioutil.ReadFile(filename)
		if err != nil {
			return nil, err
		}

		var dashCfg []*DashboardsAsConfig
		err = yaml.Unmarshal(yamlFile, &dashCfg)
		if err != nil {
			return nil, err
		}

		dashboards = append(dashboards, dashCfg...)
	}

	for i := range dashboards {
		if dashboards[i].OrgId == 0 {
			dashboards[i].OrgId = 1
		}
	}

	return dashboards, nil
}
