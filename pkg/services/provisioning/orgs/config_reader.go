package orgs

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"gopkg.in/yaml.v2"
)

type configReader interface {
	readConfig(ctx context.Context, path string) ([]*orgFile, error)
}

type configReaderImpl struct {
	log log.Logger
}

func newConfigReader(logger log.Logger) configReader {
	return &configReaderImpl{log: logger}
}

func (cr *configReaderImpl) readConfig(ctx context.Context, path string) ([]*orgFile, error) {
	var orgFiles []*orgFile

	files, err := os.ReadDir(path)
	if err != nil {
		cr.log.Error("can't read org provisioning files from directory", "path", path, "error", err)
		return orgFiles, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			org, err := cr.parseOrgConfig(path, file)
			if err != nil {
				return nil, err
			}

			if org != nil {
				orgFiles = append(orgFiles, org)
			}
		}
	}

	if err := validateRequiredField(orgFiles); err != nil {
		return nil, err
	}

	return orgFiles, nil
}

func (cr *configReaderImpl) parseOrgConfig(path string, file fs.DirEntry) (*orgFile, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *orgFileV1
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	r := cfg.mapToModel()

	return &r, nil
}

func validateRequiredField(orgFiles []*orgFile) error {
	for i := range orgFiles {
		var errStrings []string
		for index, createOrg := range orgFiles[i].CreateOrgs {
			if createOrg.Name == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("org item %d in configuration doesn't contain required field name", index+1),
				)
			}
			if createOrg.InitialAdminLoginOrEmail == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("org item %d in configuration doesn't contain required field initialAdminLoginOrEmail", index+1),
				)
			}
		}

		if len(errStrings) != 0 {
			return fmt.Errorf(strings.Join(errStrings, "\n"))
		}
	}

	return nil
}
