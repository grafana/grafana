package channelrule

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"

	"gopkg.in/yaml.v2"
)

type configReader struct {
	log log.Logger
}

func (cr *configReader) readConfig(path string) ([]*configs, error) {
	var channelRules []*configs

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("can't read channel rule provisioning files from directory", "path", path, "error", err)
		return channelRules, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			channelRule, err := cr.parseChannelRuleConfig(path, file)
			if err != nil {
				return nil, err
			}

			if channelRule != nil {
				channelRules = append(channelRules, channelRule)
			}
		}
	}

	err = cr.validateDefaultUniqueness(channelRules)
	if err != nil {
		return nil, err
	}

	return channelRules, nil
}

func (cr *configReader) parseChannelRuleConfig(path string, file os.FileInfo) (*configs, error) {
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
		apiVersion = &configVersion{APIVersion: 0}
	}

	if apiVersion.APIVersion > 0 {
		return nil, errors.New("max channel rule provisioning api version is 0")
	}

	var v0 *configsV0
	err = yaml.Unmarshal(yamlFile, &v0)
	if err != nil {
		return nil, err
	}
	return v0.mapToChannelRuleFromConfig(apiVersion.APIVersion), nil
}

func (cr *configReader) validateDefaultUniqueness(channelRules []*configs) error {
	for i := range channelRules {
		if channelRules[i].ChannelRules == nil {
			continue
		}

		for _, rule := range channelRules[i].ChannelRules {
			if rule.OrgID == 0 {
				rule.OrgID = 1
			}

			if err := cr.validateAccessAndOrgID(rule); err != nil {
				return fmt.Errorf("failed to provision %q channel rule: %w", rule.Pattern, err)
			}
		}

		for _, rule := range channelRules[i].DeleteChannelRules {
			if rule.OrgID == 0 {
				rule.OrgID = 1
			}
		}
	}

	return nil
}

func (cr *configReader) validateAccessAndOrgID(rule *upsertChannelRuleFromConfig) error {
	if err := utils.CheckOrgExists(rule.OrgID); err != nil {
		return fmt.Errorf("error checking orgId: %v", err)
	}
	return nil
}
