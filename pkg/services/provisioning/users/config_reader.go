package users

import (
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

// Find YAML files in the config path and parse them
func (cr *configReader) readConfig(path string) ([]*usersAsConfig, error) {
	var users []*usersAsConfig
	cr.log.Debug("Looking for user notification provisioning files", "path", path)

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("Can't read user provisioning files from directory", "path", path, "error", err)
		return users, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			newUsers, err := cr.parseUserConfig(path, file)
			if err != nil {
				return nil, err
			}

			if newUsers != nil {
				users = append(users, newUsers)
			}
		}
	}

	return users, nil
}

func (cr *configReader) parseUserConfig(path string, file os.FileInfo) (*usersAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *usersAsConfig
	err = yaml.Unmarshal(yamlFile, &cfg)

	if err != nil {
		return nil, err
	}

	return cfg.mapToUserFromConfig(cr), nil
}
