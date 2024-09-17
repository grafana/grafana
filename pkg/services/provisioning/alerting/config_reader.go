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
)

type rulesConfigReader struct {
	log log.Logger
}

func newRulesConfigReader(logger log.Logger) rulesConfigReader {
	return rulesConfigReader{
		log: logger,
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
		alertFileV1, err := cr.parseConfig(path, file)
		if err != nil {
			return nil, fmt.Errorf("failure to parse file %s: %w", file.Name(), err)
		}
		if alertFileV1 != nil {
			alertFileV1.Filename = file.Name()
			alertFile, err := alertFileV1.MapToModel()
			if err != nil {
				return nil, fmt.Errorf("failure to map file %s: %w", alertFileV1.Filename, err)
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

func (cr *rulesConfigReader) parseConfig(path string, file fs.DirEntry) (*AlertingFileV1, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var cfg *AlertingFileV1
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}
