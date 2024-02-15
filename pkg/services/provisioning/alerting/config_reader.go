package alerting

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
)

type rulesFile interface {
	// "map" is a reserved keyword, that's the only reason this is uppercase.
	Map() (AlertingFile, error)
}

type rulesConfigReader struct {
	log               log.Logger
	datasourceService datasources.DataSourceService
}

func newRulesConfigReader(logger log.Logger,
	datasourceService datasources.DataSourceService) rulesConfigReader {
	return rulesConfigReader{
		log:               logger,
		datasourceService: datasourceService,
	}
}

func (cr *rulesConfigReader) readConfig(ctx context.Context, path string) ([]*AlertingFile, error) {
	var alertFiles []*AlertingFile
	cr.log.Debug("looking for alerting provisioning files", "path", path)

	files, err := os.ReadDir(path)
	if err != nil {
		cr.log.Error("can't read alerting provisioning files from directory", "path", path, "error", err)
		return alertFiles, nil
	}

	for _, file := range files {
		cr.log.Debug("parsing alerting provisioning file", "path", path, "file.Name", file.Name())
		if !cr.isYAML(file.Name()) && !cr.isJSON(file.Name()) {
			cr.log.Warn(fmt.Sprintf("file has invalid suffix '%s' (.yaml,.yml,.json accepted), skipping", file.Name()))
			continue
		}
		ruleFile, err := cr.parseConfig(path, file)
		if err != nil {
			return nil, fmt.Errorf("failure to parse file %s: %w", file.Name(), err)
		}
		if ruleFile != nil {
			alertFile, err := ruleFile.Map()
			if err != nil {
				return nil, fmt.Errorf("failure to map file %s: %w", file.Name(), err)
			}
			alertFiles = append(alertFiles, &alertFile)
		}
	}
	return alertFiles, nil
}

func (cr *rulesConfigReader) isYAML(file string) bool {
	return strings.HasSuffix(file, ".yaml") || strings.HasSuffix(file, ".yml")
}

func (cr *rulesConfigReader) isJSON(file string) bool {
	return strings.HasSuffix(file, ".json")
}

func (cr *rulesConfigReader) parseConfig(path string, file fs.DirEntry) (rulesFile, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var version *configVersion
	err = yaml.Unmarshal(yamlFile, &version)
	if err != nil {
		return nil, err
	}
	switch version.APIVersion.Value() {
	case apiVersion1:
		var cfg *AlertingFileV1
		if err = yaml.Unmarshal(yamlFile, &cfg); err != nil {
			return nil, err
		}
		return cfg, nil
	case apiVersion2:
		var cfg *AlertingFileV2
		if err = yaml.Unmarshal(yamlFile, &cfg); err != nil {
			return nil, err
		}
		return &fileV2Mapper{
			datasourceService: cr.datasourceService,
			file:              cfg,
		}, nil
	default:
		return nil, fmt.Errorf("unkown API version %d in file %s", version.APIVersion.Value(), filename)
	}
}
