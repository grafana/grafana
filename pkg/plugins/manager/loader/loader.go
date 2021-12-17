package loader

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gosimple/slug"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrInvalidPluginJSON         = errors.New("did not find valid type or id properties in plugin.json")
	ErrInvalidPluginJSONFilePath = errors.New("invalid plugin.json filepath was provided")
)

var _ plugins.ErrorResolver = (*Loader)(nil)

type Loader struct {
	cfg                *plugins.Cfg
	pluginFinder       finder.Finder
	pluginInitializer  initializer.Initializer
	signatureValidator signature.Validator
	log                log.Logger

	errs map[string]*plugins.SignatureError
}

func ProvideService(cfg *setting.Cfg, license models.Licensing, authorizer plugins.PluginLoaderAuthorizer,
	backendProvider plugins.BackendFactoryProvider) (*Loader, error) {
	return New(plugins.FromGrafanaCfg(cfg), license, authorizer, backendProvider), nil
}

func New(cfg *plugins.Cfg, license models.Licensing, authorizer plugins.PluginLoaderAuthorizer,
	backendProvider plugins.BackendFactoryProvider) *Loader {
	return &Loader{
		cfg:                cfg,
		pluginFinder:       finder.New(),
		pluginInitializer:  initializer.New(cfg, backendProvider, license),
		signatureValidator: signature.NewValidator(authorizer),
		errs:               make(map[string]*plugins.SignatureError),
		log:                log.New("plugin.loader"),
	}
}

func (l *Loader) Load(ctx context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
	pluginJSONPaths, err := l.pluginFinder.Find(paths)
	if err != nil {
		l.log.Error("plugin finder encountered an error", "err", err)
	}

	return l.loadPlugins(ctx, class, pluginJSONPaths, ignore)
}

func (l *Loader) LoadWithFactory(ctx context.Context, class plugins.Class, path string, factory backendplugin.PluginFactoryFunc) (*plugins.Plugin, error) {
	p, err := l.load(ctx, class, path, map[string]struct{}{})
	if err != nil {
		l.log.Error("failed to load core plugin", "err", err)
		return nil, err
	}

	err = l.pluginInitializer.InitializeWithFactory(p, factory)

	return p, err
}

func (l *Loader) load(ctx context.Context, class plugins.Class, path string, ignore map[string]struct{}) (*plugins.Plugin, error) {
	pluginJSONPaths, err := l.pluginFinder.Find([]string{path})
	if err != nil {
		l.log.Error("failed to find plugin", "err", err)
		return nil, err
	}

	loadedPlugins, err := l.loadPlugins(ctx, class, pluginJSONPaths, ignore)
	if err != nil {
		return nil, err
	}

	if len(loadedPlugins) == 0 {
		return nil, fmt.Errorf("could not load plugin at path %s", path)
	}

	return loadedPlugins[0], nil
}

func (l *Loader) loadPlugins(ctx context.Context, class plugins.Class, pluginJSONPaths []string, existingPlugins map[string]struct{}) ([]*plugins.Plugin, error) {
	var foundPlugins = foundPlugins{}

	// load plugin.json files and map directory to JSON data
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			l.log.Warn("Skipping plugin loading as it's plugin.json is invalid", "id", plugin.ID)
			continue
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			l.log.Warn("Skipping plugin loading as full plugin.json path could not be calculated", "id", plugin.ID)
			continue
		}

		if _, dupe := foundPlugins[filepath.Dir(pluginJSONAbsPath)]; dupe {
			l.log.Warn("Skipping plugin loading as it's a duplicate", "id", plugin.ID)
			continue
		}
		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	foundPlugins.stripDuplicates(existingPlugins, l.log)

	// calculate initial signature state
	loadedPlugins := make(map[string]*plugins.Plugin)
	for pluginDir, pluginJSON := range foundPlugins {
		plugin := &plugins.Plugin{
			JSONData:  pluginJSON,
			PluginDir: pluginDir,
			Class:     class,
		}
		l.setDefaults(plugin)
		plugin.SetLogger(l.log.New("pluginID", plugin.ID))

		sig, err := signature.Calculate(l.log, plugin)
		if err != nil {
			l.log.Warn("Could not calculate plugin signature state", "pluginID", plugin.ID, "err", err)
			continue
		}
		plugin.Signature = sig.Status
		plugin.SignatureType = sig.Type
		plugin.SignatureOrg = sig.SigningOrg
		plugin.SignedFiles = sig.Files

		loadedPlugins[plugin.PluginDir] = plugin
	}

	// wire up plugin dependencies
	for _, plugin := range loadedPlugins {
		ancestors := strings.Split(plugin.PluginDir, string(filepath.Separator))
		ancestors = ancestors[0 : len(ancestors)-1]
		pluginPath := ""

		if runtime.GOOS != "windows" && filepath.IsAbs(plugin.PluginDir) {
			pluginPath = "/"
		}
		for _, ancestor := range ancestors {
			pluginPath = filepath.Join(pluginPath, ancestor)
			if parentPlugin, ok := loadedPlugins[pluginPath]; ok {
				plugin.Parent = parentPlugin
				plugin.Parent.Children = append(plugin.Parent.Children, plugin)
				break
			}
		}
	}

	// validate signatures
	verifiedPlugins := make([]*plugins.Plugin, 0)
	for _, plugin := range loadedPlugins {
		signingError := l.signatureValidator.Validate(plugin)
		if signingError != nil {
			l.log.Warn("Skipping loading plugin due to problem with signature",
				"pluginID", plugin.ID, "status", signingError.SignatureStatus)
			plugin.SignatureError = signingError
			l.errs[plugin.ID] = signingError
			// skip plugin so it will not be loaded any further
			continue
		}

		// clear plugin error if a pre-existing error has since been resolved
		delete(l.errs, plugin.ID)

		// verify module.js exists for SystemJS to load
		if !plugin.IsRenderer() && !plugin.IsCorePlugin() {
			module := filepath.Join(plugin.PluginDir, "module.js")
			if exists, err := fs.Exists(module); err != nil {
				return nil, err
			} else if !exists {
				l.log.Warn("Plugin missing module.js",
					"pluginID", plugin.ID,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
					"path", module)
			}
		}

		verifiedPlugins = append(verifiedPlugins, plugin)
	}

	for _, p := range verifiedPlugins {
		err := l.pluginInitializer.Initialize(ctx, p)
		if err != nil {
			return nil, err
		}
	}

	return verifiedPlugins, nil
}

func (l *Loader) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	l.log.Debug("Loading plugin", "path", pluginJSONPath)

	if !strings.EqualFold(filepath.Ext(pluginJSONPath), ".json") {
		return plugins.JSONData{}, ErrInvalidPluginJSONFilePath
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `currentPath` is based
	// on plugin the folder structure on disk and not user input.
	reader, err := os.Open(pluginJSONPath)
	if err != nil {
		return plugins.JSONData{}, err
	}

	plugin := plugins.JSONData{}
	if err := json.NewDecoder(reader).Decode(&plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if err := reader.Close(); err != nil {
		l.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
	}

	if err := validatePluginJSON(plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if plugin.ID == "grafana-piechart-panel" {
		plugin.Name = "Pie Chart (old)"
	}

	if len(plugin.Dependencies.Plugins) == 0 {
		plugin.Dependencies.Plugins = []plugins.Dependency{}
	}

	if plugin.Dependencies.GrafanaVersion == "" {
		plugin.Dependencies.GrafanaVersion = "*"
	}

	for _, include := range plugin.Includes {
		if include.Role == "" {
			include.Role = models.ROLE_VIEWER
		}
	}

	return plugin, nil
}

func (l *Loader) setDefaults(p *plugins.Plugin) {
	setModule(p)

	p.Info.Logos.Small = pluginLogoURL(p.Type, p.Info.Logos.Small, p.BaseURL)
	p.Info.Logos.Large = pluginLogoURL(p.Type, p.Info.Logos.Large, p.BaseURL)

	for i := 0; i < len(p.Info.Screenshots); i++ {
		p.Info.Screenshots[i].Path = evalRelativePluginURLPath(p.Info.Screenshots[i].Path, p.BaseURL, p.Type)
	}

	if p.IsApp() {
		for _, child := range p.Children {
			setChildModule(p, child)
		}

		// slugify pages
		for _, include := range p.Includes {
			if include.Slug == "" {
				include.Slug = slug.Make(include.Name)
			}
			if include.Type == "page" && include.DefaultNav {
				p.DefaultNavURL = l.cfg.AppSubURL + "/plugins/" + p.ID + "/page/" + include.Slug
			}
			if include.Type == "dashboard" && include.DefaultNav {
				p.DefaultNavURL = l.cfg.AppSubURL + "/dashboard/db/" + include.Slug
			}
		}
	}
}

func setModule(p *plugins.Plugin) {
	if p.IsCorePlugin() {
		// Previously there was an assumption that the Core plugins directory
		// should be public/app/plugins/<plugin type>/<plugin id>
		// However this can be an issue if the Core plugins directory is renamed
		baseDir := filepath.Base(p.PluginDir)

		// use path package for the following statements because these are not file paths
		p.Module = path.Join("app/plugins", string(p.Type), baseDir, "module")
		p.BaseURL = path.Join("public/app/plugins", string(p.Type), baseDir)
		return
	}

	metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))

	p.Module = path.Join("plugins", p.ID, "module")
	p.BaseURL = path.Join("public/plugins", p.ID)
}

func setChildModule(parent *plugins.Plugin, child *plugins.Plugin) {
	appSubPath := strings.ReplaceAll(strings.Replace(child.PluginDir, parent.PluginDir, "", 1), "\\", "/")
	child.IncludedInAppID = parent.ID
	child.BaseURL = parent.BaseURL

	if parent.IsCorePlugin() {
		child.Module = util.JoinURLFragments("app/plugins/app/"+parent.ID, appSubPath) + "/module"
	} else {
		child.Module = util.JoinURLFragments("plugins/"+parent.ID, appSubPath) + "/module"
	}
}

func pluginLogoURL(pluginType plugins.Type, path, baseURL string) string {
	if path == "" {
		return defaultLogoPath(pluginType)
	}

	return evalRelativePluginURLPath(path, baseURL, pluginType)
}

func defaultLogoPath(pluginType plugins.Type) string {
	return "public/img/icn-" + string(pluginType) + ".svg"
}

func evalRelativePluginURLPath(pathStr, baseURL string, pluginType plugins.Type) string {
	if pathStr == "" {
		return ""
	}

	u, _ := url.Parse(pathStr)
	if u.IsAbs() {
		return pathStr
	}

	// is set as default or has already been prefixed with base path
	if pathStr == defaultLogoPath(pluginType) || strings.HasPrefix(pathStr, baseURL) {
		return pathStr
	}

	return path.Join(baseURL, pathStr)
}

func (l *Loader) PluginErrors() []*plugins.Error {
	errs := make([]*plugins.Error, 0)
	for _, err := range l.errs {
		errs = append(errs, &plugins.Error{
			PluginID:  err.PluginID,
			ErrorCode: err.AsErrorCode(),
		})
	}

	return errs
}

func validatePluginJSON(data plugins.JSONData) error {
	if data.ID == "" || !data.Type.IsValid() {
		return ErrInvalidPluginJSON
	}
	return nil
}

type foundPlugins map[string]plugins.JSONData

// stripDuplicates will strip duplicate plugins or plugins that already exist
func (f *foundPlugins) stripDuplicates(existingPlugins map[string]struct{}, log log.Logger) {
	pluginsByID := make(map[string]struct{})
	for k, scannedPlugin := range *f {
		if _, existing := existingPlugins[scannedPlugin.ID]; existing {
			log.Debug("Skipping plugin as it's already installed", "plugin", scannedPlugin.ID)
			delete(*f, k)
			continue
		}

		pluginsByID[scannedPlugin.ID] = struct{}{}
	}
}
