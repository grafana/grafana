package manager

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/infra/fs"

	"github.com/grafana/grafana/pkg/registry"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var pluginTypes = map[string]interface{}{
	"panel":      plugins.PanelPlugin{},
	"datasource": plugins.DataSourcePlugin{},
	"app":        plugins.AppPlugin{},
	"renderer":   plugins.RendererPlugin{},
}

type Loader struct {
	Cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`

	log log.Logger

	signatureValidator PluginSignatureValidator

	AllowUnsignedPluginsCondition unsignedPluginV2ConditionFunc
}

func init() {
	logger := log.New("plugin.loader")

	registry.Register(&registry.Descriptor{
		Name: "PluginLoader",
		Instance: &Loader{
			log: logger,
			signatureValidator: PluginSignatureValidator{
				log:           logger,
				requireSigned: false, // maybe should be part of load func signature?
				//allowUnsignedPluginsCondition: l.AllowUnsignedPluginsCondition,
			},
		},
		InitPriority: registry.MediumHigh,
	})
}

func (l *Loader) Init() error {
	return nil
}

func (l *Loader) Load(pluginJSONPaths []string) ([]*plugins.PluginV2, error) {
	var foundPlugins = make(map[string]*plugins.PluginV2)

	for _, pluginJSONPath := range pluginJSONPaths {
		l.log.Debug("Loading plugin", "path", pluginJSONPath)
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `currentPath` is based
		// on plugin the folder structure on disk and not user input.
		reader, err := os.Open(pluginJSONPath)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := reader.Close(); err != nil {
				l.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
			}
		}()

		jsonParser := json.NewDecoder(reader)
		plugin := &plugins.PluginV2{}
		if err := jsonParser.Decode(&plugin); err != nil {
			return nil, err
		}

		if plugin.ID == "" || plugin.Type == "" {
			return nil, errors.New("did not find type or id properties in plugin.json")
		}

		plugin.PluginDir = filepath.Dir(pluginJSONPath)
		plugin.Files, err = collectPluginFilesWithin(plugin.PluginDir)
		if err != nil {
			l.log.Warn("Could not collect plugin file information in directory", "pluginID", plugin.ID, "dir", plugin.PluginDir)
			return nil, err
		}

		signatureState, err := pluginSignatureState(l.log, plugin)
		if err != nil {
			l.log.Warn("Could not get plugin signature state", "pluginID", plugin.ID, "err", err)
			return nil, err
		}
		plugin.Signature = signatureState.Status
		plugin.SignatureType = signatureState.Type
		plugin.SignatureOrg = signatureState.SigningOrg

		foundPlugins[filepath.Dir(pluginJSONPath)] = plugin
	}

	// wire up plugin dependencies
	for _, plugin := range foundPlugins {
		ancestors := strings.Split(plugin.PluginDir, string(filepath.Separator)) // safe to use PluginDir instead of `key`?
		ancestors = ancestors[0 : len(ancestors)-1]
		aPath := ""

		if runtime.GOOS != "windows" && filepath.IsAbs(plugin.PluginDir) {
			aPath = "/"
		}
		for _, a := range ancestors {
			aPath = filepath.Join(aPath, a)
			if parent, ok := foundPlugins[aPath]; ok {
				plugin.Parent = parent
				plugin.Parent.Children = append(plugin.Parent.Children, plugin)
				break
			}
		}
	}

	// start of second pass
	for _, plugin := range foundPlugins {
		pmlog.Debug("Found plugin", "id", plugin.ID, "signature", plugin.Signature, "hasParent", plugin.Parent != nil)
		signingError := l.signatureValidator.validate(plugin)
		if signingError != nil {
			pmlog.Debug("Failed to validate plugin signature. Will skip loading", "id", plugin.ID,
				"signature", plugin.Signature, "status", signingError.ErrorCode)
			//pm.pluginScanningErrors[plugin.Id] = *signingError
			return nil, nil // collect scanning error
		}

		pmlog.Debug("Attempting to add plugin", "id", plugin.ID)

		pluginGoType, exists := pluginTypes[plugin.Type]
		if !exists {
			return nil, fmt.Errorf("unknown plugin type %q", plugin.Type)
		}

		pluginJSONPath := filepath.Join(plugin.PluginDir, "plugin.json")

		// External plugins need a module.js file for SystemJS to load
		if !strings.HasPrefix(pluginJSONPath, l.Cfg.StaticRootPath) && !isRendererPlugin(plugin.Type) {
			module := filepath.Join(plugin.PluginDir, "module.js")
			exists, err := fs.Exists(module)
			if err != nil {
				return nil, err
			}
			if !exists {
				pmlog.Warn("Plugin missing module.js",
					"name", plugin.Name,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
					"path", module)
			}
		}

		// Probably can optimize this

		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `jsonFPath` is based
		// on plugin the folder structure on disk and not user input.
		reader, err := os.Open(pluginJSONPath)
		defer func() {
			if err := reader.Close(); err != nil {
				pmlog.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
			}
		}()
		if err != nil {
			return nil, err
		}
		jsonParser := json.NewDecoder(reader)
		loader := reflect.New(reflect.TypeOf(pluginGoType)).Interface().(plugins.PluginLoader)

		if err := jsonParser.Decode(loader); err != nil {
			return nil, err
		}

		err = loader.LoadV2(plugin.PluginDir, l.BackendPluginManager)
		if err != nil {
			return nil, err
		}

		//var pb *plugins.PluginV2
		//switch p := loader.(type) {
		//case *plugins.DataSourcePlugin:
		//	//pm.dataSources[p.Id] = p
		//	pb = &p.PluginBase
		//case *plugins.PanelPlugin:
		//	//pm.panels[p.Id] = p
		//	pb = &p.PluginBase
		//case *plugins.RendererPlugin:
		//	//pm.renderer = p
		//	pb = &p.PluginBase
		//case *plugins.AppPlugin:
		//	//pm.apps[p.Id] = p
		//	pb = &p.PluginBase
		//default:
		//	panic(fmt.Sprintf("Unrecognized plugin type %T", loader))
		//}

		//if p, exists := pm.plugins[pb.Id]; exists {
		//	l.log.Warn("Plugin is duplicate", "id", pb.Id)
		//	scanner.errors = append(scanner.errors, plugins.DuplicatePluginError{Plugin: pb, ExistingPlugin: p})
		//	return nil, nil // return duplicate error?
		//}

		// Probably can remove
		if !strings.HasPrefix(plugin.PluginDir, l.Cfg.StaticRootPath) {
			l.log.Info("Registering plugin", "id", plugin.ID)
		}

		if len(plugin.Dependencies.Plugins) == 0 {
			plugin.Dependencies.Plugins = []plugins.PluginDependencyItem{}
		}

		if plugin.Dependencies.GrafanaVersion == "" {
			plugin.Dependencies.GrafanaVersion = "*"
		}

		for _, include := range plugin.Includes {
			if include.Role == "" {
				include.Role = models.ROLE_VIEWER
			}
		}

		// Copy relevant fields from the base
		//pb.PluginDir = plugin.PluginDir
		//pb.Signature = plugin.Signature
		//pb.SignatureType = plugin.SignatureType
		//pb.SignatureOrg = plugin.SignatureOrg

		//pm.plugins[pb.Id] = pb

		l.log.Debug("Successfully added plugin", "id", plugin.ID)

		//if len(scanner.errors) > 0 {
		//	pmlog.Warn("Some plugins failed to load", "errors", scanner.errors)
		//	pm.scanningErrors = scanner.errors
		//}
	}

	res := make([]*plugins.PluginV2, 0, len(foundPlugins))

	for _, p := range foundPlugins {
		res = append(res, p)
	}

	return res, nil
}

func isRendererPlugin(pluginType string) bool {
	return pluginType == "renderer"
}

func pluginSignatureState(log log.Logger, plugin *plugins.PluginV2) (plugins.PluginSignatureState, error) {
	log.Debug("Getting signature state of plugin", "plugin", plugin.ID, "isBackend", plugin.Backend)
	manifestPath := filepath.Join(plugin.PluginDir, "MANIFEST.txt")

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `manifestPath` is based
	// on plugin the folder structure on disk and not user input.
	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		log.Debug("Plugin is unsigned", "id", plugin.ID)
		return plugins.PluginSignatureState{
			Status: plugins.PluginSignatureUnsigned,
		}, nil
	}

	manifest, err := readPluginManifest(byteValue)
	if err != nil {
		log.Debug("Plugin signature invalid", "id", plugin.ID)
		return plugins.PluginSignatureState{
			Status: plugins.PluginSignatureInvalid,
		}, nil
	}

	// Make sure the versions all match
	if manifest.Plugin != plugin.ID || manifest.Version != plugin.Info.Version {
		return plugins.PluginSignatureState{
			Status: plugins.PluginSignatureModified,
		}, nil
	}

	// Validate that private is running within defined root URLs
	if manifest.SignatureType == plugins.PrivateType {
		appURL, err := url.Parse(setting.AppUrl)
		if err != nil {
			return plugins.PluginSignatureState{}, err
		}

		foundMatch := false
		for _, u := range manifest.RootURLs {
			rootURL, err := url.Parse(u)
			if err != nil {
				log.Warn("Could not parse plugin root URL", "plugin", plugin.ID, "rootUrl", rootURL)
				return plugins.PluginSignatureState{}, err
			}
			if rootURL.Scheme == appURL.Scheme &&
				rootURL.Host == appURL.Host &&
				rootURL.RequestURI() == appURL.RequestURI() {
				foundMatch = true
				break
			}
		}

		if !foundMatch {
			log.Warn("Could not find root URL that matches running application URL", "plugin", plugin.ID,
				"appUrl", appURL, "rootUrls", manifest.RootURLs)
			return plugins.PluginSignatureState{
				Status: plugins.PluginSignatureInvalid,
			}, nil
		}
	}

	manifestFiles := make(map[string]bool, len(manifest.Files))

	// Verify the manifest contents
	log.Debug("Verifying contents of plugin manifest", "plugin", plugin.ID)
	for p, hash := range manifest.Files {
		// Open the file
		fp := filepath.Join(plugin.PluginDir, p)

		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `fp` is based
		// on the manifest file for a plugin and not user input.
		f, err := os.Open(fp)
		if err != nil {
			log.Warn("Plugin file listed in the manifest was not found", "plugin", plugin.ID, "filename", p, "dir", plugin.PluginDir)
			return plugins.PluginSignatureState{
				Status: plugins.PluginSignatureModified,
			}, nil
		}
		defer func() {
			if err := f.Close(); err != nil {
				log.Warn("Failed to close plugin file", "path", fp, "err", err)
			}
		}()

		h := sha256.New()
		if _, err := io.Copy(h, f); err != nil {
			log.Warn("Couldn't read plugin file", "plugin", plugin.ID, "filename", fp)
			return plugins.PluginSignatureState{
				Status: plugins.PluginSignatureModified,
			}, nil
		}
		sum := hex.EncodeToString(h.Sum(nil))
		if sum != hash {
			log.Warn("Plugin file's signature has been modified versus manifest", "plugin", plugin.ID, "filename", fp)
			return plugins.PluginSignatureState{
				Status: plugins.PluginSignatureModified,
			}, nil
		}
		manifestFiles[p] = true
	}

	if manifest.isV2() {
		// Track files missing from the manifest
		var unsignedFiles []string
		for _, f := range plugin.Files {
			if _, exists := manifestFiles[f]; !exists {
				unsignedFiles = append(unsignedFiles, f)
			}
		}

		if len(unsignedFiles) > 0 {
			log.Warn("The following files were not included in the signature", "plugin", plugin.ID, "files", unsignedFiles)
			return plugins.PluginSignatureState{
				Status: plugins.PluginSignatureModified,
			}, nil
		}
	}

	log.Debug("Plugin signature valid", "id", plugin.ID)
	return plugins.PluginSignatureState{
		Status:     plugins.PluginSignatureValid,
		Type:       manifest.SignatureType,
		SigningOrg: manifest.SignedByOrgName,
	}, nil
}
