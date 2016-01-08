package plugins

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	DataSources  map[string]*DataSourcePlugin
	Panels       map[string]*PanelPlugin
	ApiPlugins   map[string]*ApiPlugin
	StaticRoutes []*PublicContent
	Apps         map[string]*AppPlugin
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() error {
	DataSources = make(map[string]*DataSourcePlugin)
	ApiPlugins = make(map[string]*ApiPlugin)
	StaticRoutes = make([]*PublicContent, 0)
	Panels = make(map[string]*PanelPlugin)
	Apps = make(map[string]*AppPlugin)

	scan(path.Join(setting.StaticRootPath, "app/plugins"))
	checkPluginPaths()
	// checkDependencies()
	return nil
}

// func checkDependencies() {
// 	for appType, app := range Apps {
// 		for _, reqPanel := range app.PanelPlugins {
// 			if _, ok := Panels[reqPanel]; !ok {
// 				log.Fatal(4, "App %s requires Panel type %s, but it is not present.", appType, reqPanel)
// 			}
// 		}
// 		for _, reqDataSource := range app.DatasourcePlugins {
// 			if _, ok := DataSources[reqDataSource]; !ok {
// 				log.Fatal(4, "App %s requires DataSource type %s, but it is not present.", appType, reqDataSource)
// 			}
// 		}
// 		for _, reqApiPlugin := range app.ApiPlugins {
// 			if _, ok := ApiPlugins[reqApiPlugin]; !ok {
// 				log.Fatal(4, "App %s requires ApiPlugin type %s, but it is not present.", appType, reqApiPlugin)
// 			}
// 		}
// 	}
// }

func checkPluginPaths() error {
	for _, section := range setting.Cfg.Sections() {
		if strings.HasPrefix(section.Name(), "plugin.") {
			path := section.Key("path").String()
			if path != "" {
				log.Info("Plugin: Scaning dir %s", path)
				scan(path)
			}
		}
	}
	return nil
}

func scan(pluginDir string) error {
	scanner := &PluginScanner{
		pluginPath: pluginDir,
	}

	if err := util.Walk(pluginDir, true, true, scanner.walker); err != nil {
		if pluginDir != "data/plugins" {
			log.Warn("Could not scan dir \"%v\" error: %s", pluginDir, err)
		}
		return err
	}

	if len(scanner.errors) > 0 {
		return errors.New("Some plugins failed to load")
	}

	return nil
}

func (scanner *PluginScanner) walker(currentPath string, f os.FileInfo, err error) error {
	if err != nil {
		return err
	}

	if f.IsDir() {
		return nil
	}

	if f.Name() == "plugin.json" {
		err := scanner.loadPluginJson(currentPath)
		if err != nil {
			log.Error(3, "Failed to load plugin json file: %v,  err: %v", currentPath, err)
			scanner.errors = append(scanner.errors, err)
		}
	}
	return nil
}

func addPublicContent(public *PublicContent, currentDir string) {
	if public != nil {
		public.Dir = path.Join(currentDir, public.Dir)
		StaticRoutes = append(StaticRoutes, public)
	}
}

func interpolatePluginJson(reader io.Reader, pluginCommon *PluginCommon) (io.Reader, error) {
	buf := new(bytes.Buffer)
	buf.ReadFrom(reader)
	jsonStr := buf.String() //

	tmpl, err := template.New("json").Parse(jsonStr)
	if err != nil {
		return nil, err
	}

	data := map[string]interface{}{
		"PluginPublicRoot": "public/plugins/" + pluginCommon.Id,
	}

	var resultBuffer bytes.Buffer
	if err := tmpl.ExecuteTemplate(&resultBuffer, "json", data); err != nil {
		return nil, err
	}

	return bytes.NewReader(resultBuffer.Bytes()), nil
}

func (scanner *PluginScanner) loadPluginJson(pluginJsonFilePath string) error {
	currentDir := filepath.Dir(pluginJsonFilePath)
	reader, err := os.Open(pluginJsonFilePath)
	if err != nil {
		return err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)
	pluginCommon := PluginCommon{}
	if err := jsonParser.Decode(&pluginCommon); err != nil {
		return err
	}

	if pluginCommon.Id == "" || pluginCommon.Type == "" {
		return errors.New("Did not find type and id property in plugin.json")
	}

	reader.Seek(0, 0)

	if newReader, err := interpolatePluginJson(reader, &pluginCommon); err != nil {
		return err
	} else {
		jsonParser = json.NewDecoder(newReader)
	}

	switch pluginCommon.Type {
	case "datasource":
		p := DataSourcePlugin{}
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}

		DataSources[p.Id] = &p
		addPublicContent(p.PublicContent, currentDir)

	case "panel":
		p := PanelPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}

		Panels[p.Id] = &p
		addPublicContent(p.PublicContent, currentDir)
	case "api":
		p := ApiPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		ApiPlugins[p.Id] = &p
	case "app":
		p := AppPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		Apps[p.Id] = &p
		addPublicContent(p.PublicContent, currentDir)
	default:
		return errors.New("Unkown plugin type " + pluginCommon.Type)
	}

	return nil
}

func GetEnabledPlugins(orgApps []*models.AppPlugin) EnabledPlugins {
	enabledPlugins := NewEnabledPlugins()

	orgAppsMap := make(map[string]*models.AppPlugin)
	for _, orgApp := range orgApps {
		orgAppsMap[orgApp.Type] = orgApp
	}
	seenPanels := make(map[string]bool)
	seenApi := make(map[string]bool)

	for appType, installedApp := range Apps {
		var app AppPlugin
		app = *installedApp

		// check if the app is stored in the DB for this org and if so, use the
		// state stored there.
		if b, ok := orgAppsMap[appType]; ok {
			app.Enabled = b.Enabled
			app.Pinned = b.Pinned
		}

		// if app.Enabled {
		// 	for _, d := range app.DatasourcePlugins {
		// 		if ds, ok := DataSources[d]; ok {
		// 			enabledPlugins.DataSourcePlugins[d] = ds
		// 		}
		// 	}
		// 	for _, p := range app.PanelPlugins {
		// 		if panel, ok := Panels[p]; ok {
		// 			if _, ok := seenPanels[p]; !ok {
		// 				seenPanels[p] = true
		// 				enabledPlugins.PanelPlugins = append(enabledPlugins.PanelPlugins, panel)
		// 			}
		// 		}
		// 	}
		// 	for _, a := range app.ApiPlugins {
		// 		if api, ok := ApiPlugins[a]; ok {
		// 			if _, ok := seenApi[a]; !ok {
		// 				seenApi[a] = true
		// 				enabledPlugins.ApiPlugins = append(enabledPlugins.ApiPlugins, api)
		// 			}
		// 		}
		// 	}
		// 	enabledPlugins.AppPlugins = append(enabledPlugins.AppPlugins, &app)
		// }
	}

	// add all plugins that are not part of an App.
	for d, installedDs := range DataSources {
		if installedDs.App == "" {
			enabledPlugins.DataSources[d] = installedDs
		}
	}

	for p, panel := range Panels {
		if panel.App == "" {
			if _, ok := seenPanels[p]; !ok {
				seenPanels[p] = true
				enabledPlugins.Panels = append(enabledPlugins.Panels, panel)
			}
		}
	}

	for a, api := range ApiPlugins {
		if api.App == "" {
			if _, ok := seenApi[a]; !ok {
				seenApi[a] = true
				enabledPlugins.ApiList = append(enabledPlugins.ApiList, api)
			}
		}
	}

	return enabledPlugins
}
