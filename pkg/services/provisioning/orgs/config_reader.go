package orgs

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/log"
)

type configReader struct {
	log log.Logger
}

func newConfigReader(logger log.Logger) *configReader {
	return &configReader{log: logger}
}

func (cr *configReader) readConfig(ctx context.Context, path string) ([]*configs, error) {
	var orgs []*configs

	files, err := os.ReadDir(path)
	if err != nil {
		cr.log.Error("can't read orgs provisioning files from directory", "path", path, "error", err)
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

	if err := validateRequiredField(orgs); err != nil {
		return nil, err
	}

	return orgs, nil
}

func (cr *configReader) parseOrgConfig(path string, file fs.DirEntry) (*configs, error) {
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

	v1 := &configsV1{}
	err = yaml.Unmarshal(yamlFile, v1)
	if err != nil {
		return nil, err
	}

	return v1.mapToOrgsFromConfig(apiVersion.APIVersion), nil
}

func validateRequiredField(orgs []*configs) error {
	for i := range orgs {
		errs := []error{}
		for index, createOrg := range orgs[i].Orgs {
			if createOrg.Name == "" {
				err := fmt.Errorf("org item %d in configuration doesn't contain required field name", index+1)
				errs = append(errs, err)
			}
		}

		if len(errs) != 0 {
			return errors.Join(errs...)
		}
	}

	return nil
}
