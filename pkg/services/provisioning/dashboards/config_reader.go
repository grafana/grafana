package dashboards

import (
	"io/ioutil"
	"path/filepath"
	"strings"

	yaml "gopkg.in/yaml.v2"
)

type configReader struct {
	path string
}

func (cr *configReader) readConfig() ([]*DashboardsAsConfig, error) {
	files, err := ioutil.ReadDir(cr.path)
	if err != nil {
		return nil, err
	}

	var dashboards []*DashboardsAsConfig
	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".yaml") && !strings.HasSuffix(file.Name(), ".yml") {
			continue
		}

		filename, _ := filepath.Abs(filepath.Join(cr.path, file.Name()))
		yamlFile, err := ioutil.ReadFile(filename)
		if err != nil {
			return nil, err
		}

		var datasource []*DashboardsAsConfig
		err = yaml.Unmarshal(yamlFile, &datasource)
		if err != nil {
			return nil, err
		}

		dashboards = append(dashboards, datasource...)
	}

	for i := range dashboards {
		if dashboards[i].OrgId == 0 {
			dashboards[i].OrgId = 1
		}
	}

	return dashboards, nil
}
