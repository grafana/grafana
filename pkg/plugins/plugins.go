package plugins

import (
	"encoding/json"
	"errors"
	"os"
	"path"
	"path/filepath"

	"github.com/wangy1931/grafana/pkg/log"
	"github.com/wangy1931/grafana/pkg/setting"
)

type PluginMeta struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

var (
	DataSources map[string]interface{}
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() {
	scan(path.Join(setting.StaticRootPath, "app/plugins"))
}

func scan(pluginDir string) error {
	DataSources = make(map[string]interface{})

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
		err := scanner.loadPluginJson(path)
		if err != nil {
			log.Error(3, "Failed to load plugin json file: %v,  err: %v", path, err)
			scanner.errors = append(scanner.errors, err)
		}
	}
	return nil
}

func (scanner *PluginScanner) loadPluginJson(path string) error {
	reader, err := os.Open(path)
	if err != nil {
		return err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)

	pluginJson := make(map[string]interface{})
	if err := jsonParser.Decode(&pluginJson); err != nil {
		return err
	}

	pluginType, exists := pluginJson["pluginType"]
	if !exists {
		return errors.New("Did not find pluginType property in plugin.json")
	}

	if pluginType == "datasource" {
		datasourceType, exists := pluginJson["type"]
		if !exists {
			return errors.New("Did not find type property in plugin.json")
		}
		DataSources[datasourceType.(string)] = pluginJson
	}

	return nil
}
