package plugins

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/log"
)

type PluginMeta struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

var (
	List []*PluginMeta
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Scan(pluginDir string) error {
	List = make([]*PluginMeta, 0)

	scanner := &PluginScanner{
		pluginPath: pluginDir,
	}

	if err := filepath.Walk(pluginDir, scanner.walker); err != nil {
		return err
	}

	if len(scanner.errors) > 0 {
		return errors.New("Some plugins failed to load")
	}

	return nil
}

func (scanner *PluginScanner) walker(path string, f os.FileInfo, err error) error {
	if err != nil {
		return err
	}

	if f.IsDir() {
		return nil
	}

	if f.Name() == "plugin.json" {
		pluginMeta, err := loadPluginMeta(path)
		if err != nil {
			log.Error(3, "Failed to load plugin json file: %v,  err: %v", path, err)
			scanner.errors = append(scanner.errors, err)
		} else {
			List = append(List, pluginMeta)
		}
	}
	return nil
}

func loadPluginMeta(path string) (*PluginMeta, error) {
	reader, err := os.Open(path)
	if err != nil {
		return nil, err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)

	pluginMeta := &PluginMeta{}
	if err := jsonParser.Decode(pluginMeta); err != nil {
		return nil, err
	}

	return pluginMeta, nil
}
