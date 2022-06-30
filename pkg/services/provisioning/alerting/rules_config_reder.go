package alerting

import (
	"context"
	"fmt"
	"io/fs"
	"io/ioutil"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"gopkg.in/yaml.v2"
)

type rulesConfigReader struct {
	log log.Logger
}

func NewRulesConfigReader(logger log.Logger) rulesConfigReader {
	return rulesConfigReader{
		log: logger,
	}
}

func (cr *rulesConfigReader) readConfig(ctx context.Context, path string) ([]*RuleFileV1, error) {
	var alertRulesFiles []*RuleFileV1
	cr.log.Debug("Looking for alert rules provisioning files", "path", path)

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("Can't read alert rules provisioning files from directory", "path", path, "error", err)
		return alertRulesFiles, nil
	}

	for _, file := range files {
		var ruleFile *RuleFileV1
		cr.log.Debug("Parsing alert rules provisioning file", "path", path, "file.Name", file.Name())
		if cr.isYAML(file.Name()) || cr.isJSON(file.Name()) {
			ruleFile, err = cr.parseConfig(path, file)
		} else {
			return nil, fmt.Errorf("file has invalid suffix '%s' (.yaml,.yml,.json accepted)", file.Name())
		}
		if err != nil {
			return nil, err
		}
		if ruleFile != nil {
			alertRulesFiles = append(alertRulesFiles, ruleFile)
		}
	}
	return alertRulesFiles, nil
}

func (cr *rulesConfigReader) isYAML(file string) bool {
	return strings.HasSuffix(file, ".yaml") || strings.HasSuffix(file, ".yml")
}

func (cr *rulesConfigReader) isJSON(file string) bool {
	return strings.HasSuffix(file, ".json")
}

func (cr *rulesConfigReader) parseConfig(path string, file fs.FileInfo) (*RuleFileV1, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *RuleFileV1
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	// TODO: run validation, fail early

	return cfg, nil
}
