package plugins

import (
	"encoding/json"
	"errors"
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	DataSources     map[string]DataSourcePlugin
	ExternalPlugins []ExternalPlugin
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() {
	DataSources = make(map[string]DataSourcePlugin)
	ExternalPlugins = make([]ExternalPlugin, 0)

	scan(path.Join(setting.StaticRootPath, "app/plugins"))
	scan(path.Join(setting.DataPath, "plugins"))
}

func scan(pluginDir string) error {
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
		p := DataSourcePlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}

		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}

		DataSources[p.Type] = p
	}

	if pluginType == "externalPlugin" {
		p := ExternalPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		ExternalPlugins = append(ExternalPlugins, p)
	}

	return nil
}
