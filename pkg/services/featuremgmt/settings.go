package featuremgmt

import (
	"os"

	"gopkg.in/yaml.v3"
)

type configBody struct {
	// define variables that can be used in expressions
	Vars map[string]interface{} `yaml:"vars"`

	// Define and override feature flag properties
	Flags []FeatureFlag `yaml:"flags"`

	// keep track of where the fie was loaded from
	filename string
}

// will read a single configfile
func readConfigFile(filename string) (*configBody, error) {
	cfg := &configBody{}

	// Can ignore gosec G304 because the file path is forced within config subfolder
	//nolint:gosec
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return cfg, err
	}

	err = yaml.Unmarshal(yamlFile, cfg)
	cfg.filename = filename
	return cfg, err
}
