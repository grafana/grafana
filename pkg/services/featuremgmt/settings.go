package featuremgmt

import (
	"io/ioutil"

	"gopkg.in/yaml.v2"
)

type configBody struct {
	Vars  map[string]interface{} `toml:"vars"`
	Flags []FeatureFlag          `toml:"flags"`

	// Runtime loaded properties
	filename string
	included map[string]*configBody
}

// will read a single configfile
func readConfigFile(filename string) (*configBody, error) {
	cfg := &configBody{}

	// Can ignore gosec G304 because the file path is forced within config subfolder
	//nolint:gosec
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return cfg, err
	}

	err = yaml.Unmarshal(yamlFile, cfg)
	cfg.filename = filename
	return cfg, err
}
