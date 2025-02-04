package datasources

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
)

type configReader struct {
	log        log.Logger
	orgService org.Service
}

func (cr *configReader) readConfig(ctx context.Context, path string) ([]*configs, error) {
	var datasources []*configs

	files, err := os.ReadDir(path)
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

	err = cr.validateDefaultUniqueness(ctx, datasources)
	if err != nil {
		return nil, err
	}

	return datasources, nil
}

func (cr *configReader) parseDatasourceConfig(path string, file fs.DirEntry) (*configs, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var apiVersion *configVersion
	err = yaml.Unmarshal(yamlFile, &apiVersion)
	if err != nil {
		return nil, err
	}

	if apiVersion == nil {
		apiVersion = &configVersion{APIVersion: 0}
	}

	if apiVersion.APIVersion > 0 {
		v1 := &configsV1{log: cr.log}
		err = yaml.Unmarshal(yamlFile, v1)
		if err != nil {
			return nil, err
		}

		return v1.mapToDatasourceFromConfig(apiVersion.APIVersion), nil
	}

	var v0 *configsV0
	err = yaml.Unmarshal(yamlFile, &v0)
	if err != nil {
		return nil, err
	}

	cr.log.Warn("[Deprecated] the datasource provisioning config is outdated. please upgrade", "filename", filename)

	return v0.mapToDatasourceFromConfig(apiVersion.APIVersion), nil
}

func (cr *configReader) validateDefaultUniqueness(ctx context.Context, datasources []*configs) error {
	defaultCount := map[int64]int{}
	for i := range datasources {
		for _, ds := range datasources[i].Datasources {
			if ds == nil {
				continue
			}

			if ds.OrgID == 0 {
				ds.OrgID = 1
			}

			if err := cr.validateAccessAndOrgID(ctx, ds); err != nil {
				return fmt.Errorf("failed to provision %q data source: %w", ds.Name, err)
			}

			if ds.IsDefault {
				defaultCount[ds.OrgID]++
				if defaultCount[ds.OrgID] > 1 {
					return ErrInvalidConfigToManyDefault
				}
			}
		}

		for _, ds := range datasources[i].DeleteDatasources {
			if ds == nil {
				continue
			}

			if ds.OrgID == 0 {
				ds.OrgID = 1
			}
		}
	}

	return nil
}

func (cr *configReader) validateAccessAndOrgID(ctx context.Context, ds *upsertDataSourceFromConfig) error {
	checker := utils.NewOrgExistsChecker(cr.orgService)
	if err := checker(ctx, ds.OrgID); err != nil {
		return err
	}

	if ds.Access == "" {
		ds.Access = datasources.DS_ACCESS_PROXY
	}

	if ds.Access != datasources.DS_ACCESS_DIRECT && ds.Access != datasources.DS_ACCESS_PROXY {
		cr.log.Warn("invalid access value, will use 'proxy' instead", "value", ds.Access)
		ds.Access = datasources.DS_ACCESS_PROXY
	}
	return nil
}
