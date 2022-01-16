package orgs

import (
	"context"
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

func (cr *configReader) readConfig(ctx context.Context, path string) ([]*configs, error) {
	var orgs []*configs

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("can't read org provisioning files from directory", "path", path, "error", err)
		return orgs, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			org, err := cr.parseOrgConfig(path, file)
			if err != nil {
				return nil, err
			}

			if org != nil {
				orgs = append(orgs, org)
			}
		}
	}

	return orgs, nil
}

func (cr *configReader) parseOrgConfig(path string, file os.FileInfo) (*configs, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var apiVersion *configVersion
	err = yaml.Unmarshal(yamlFile, &apiVersion)
	if err != nil {
		return nil, err
	}

	if apiVersion == nil {
		apiVersion = &configVersion{APIVersion: 1}
	}

	v1 := &configsV1{log: cr.log}
	err = yaml.Unmarshal(yamlFile, v1)
	if err != nil {
		return nil, err
	}

	return v1.mapToOrgFromConfig(apiVersion.APIVersion), nil
}
