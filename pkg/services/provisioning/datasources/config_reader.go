package datasources

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"gopkg.in/yaml.v2"
)

type configReader struct {
	log log.Logger
}

func (cr *configReader) readConfig(path string) ([]*DatasourcesAsConfig, error) {
	var datasources []*DatasourcesAsConfig

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("can't read datasource provisioning files from directory", "path", path, "error", err)
		return datasources, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			datasource, err := cr.parseDatasourceConfig(path, file)
			if err != nil {
				return nil, err
			}

			if datasource != nil {
				datasources = append(datasources, datasource)
			}
		}
	}

	err = validateDefaultUniqueness(datasources)
	if err != nil {
		return nil, err
	}

	return datasources, nil
}

func (cr *configReader) parseDatasourceConfig(path string, file os.FileInfo) (*DatasourcesAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var apiVersion *ConfigVersion
	err = yaml.Unmarshal(yamlFile, &apiVersion)
	if err != nil {
		return nil, err
	}

	if apiVersion == nil {
		apiVersion = &ConfigVersion{ApiVersion: 0}
	}

	if apiVersion.ApiVersion > 0 {
		v1 := &DatasourcesAsConfigV1{log: cr.log}
		err = yaml.Unmarshal(yamlFile, v1)
		if err != nil {
			return nil, err
		}

		return v1.mapToDatasourceFromConfig(apiVersion.ApiVersion), nil
	}

	var v0 *DatasourcesAsConfigV0
	err = yaml.Unmarshal(yamlFile, &v0)
	if err != nil {
		return nil, err
	}

	cr.log.Warn("[Deprecated] the datasource provisioning config is outdated. please upgrade", "filename", filename)

	return v0.mapToDatasourceFromConfig(apiVersion.ApiVersion), nil
}

func validateDefaultUniqueness(datasources []*DatasourcesAsConfig) error {
	defaultCount := map[int64]int{}
	for i := range datasources {
		if datasources[i].Datasources == nil {
			continue
		}

		for _, ds := range datasources[i].Datasources {
			if ds.OrgId == 0 {
				ds.OrgId = 1
			}

			if ds.IsDefault {
				defaultCount[ds.OrgId] = defaultCount[ds.OrgId] + 1
				if defaultCount[ds.OrgId] > 1 {
					return ErrInvalidConfigToManyDefault
				}
			}
		}

		for _, ds := range datasources[i].DeleteDatasources {
			if ds.OrgId == 0 {
				ds.OrgId = 1
			}
		}
	}

	return nil
}
