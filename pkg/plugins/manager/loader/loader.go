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

	"github.com/grafana/grafana/pkg/plugins/pluginscdn"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/logger"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrInvalidPluginJSON         = errors.New("did not find valid type or id properties in plugin.json")
	ErrInvalidPluginJSONFilePath = errors.New("invalid plugin.json filepath was provided")
)

var _ plugins.ErrorResolver = (*Loader)(nil)

type Loader struct {
	pluginFinder       finder.Finder
	processManager     process.Service
	pluginRegistry     registry.Service
	roleRegistry       plugins.RoleRegistry
	pluginInitializer  initializer.Initializer
	signatureValidator signature.Validator
	pluginStorage      storage.Manager
	log                log.Logger
	cfg                *config.Cfg

	errs map[string]*plugins.SignatureError
}

func ProvideService(cfg *config.Cfg, license models.Licensing, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service, backendProvider plugins.BackendFactoryProvider,
	roleRegistry plugins.RoleRegistry) *Loader {
	return New(cfg, license, authorizer, pluginRegistry, backendProvider, process.NewManager(pluginRegistry),
		storage.FileSystem(logger.NewLogger("loader.fs"), cfg.PluginsPath), roleRegistry)
}

func New(cfg *config.Cfg, license models.Licensing, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service, backendProvider plugins.BackendFactoryProvider,
	processManager process.Service, pluginStorage storage.Manager, roleRegistry plugins.RoleRegistry) *Loader {
	return &Loader{
		pluginFinder:       finder.New(),
		pluginRegistry:     pluginRegistry,
		pluginInitializer:  initializer.New(cfg, backendProvider, license),
		signatureValidator: signature.NewValidator(authorizer),
		processManager:     processManager,
		pluginStorage:      pluginStorage,
		errs:               make(map[string]*plugins.SignatureError),
		log:                log.New("plugin.loader"),
		roleRegistry:       roleRegistry,
		cfg:                cfg,
	}
}

func (l *Loader) Load(ctx context.Context, class plugins.Class, paths []string) ([]*plugins.Plugin, error) {
	pluginJSONPaths, err := l.pluginFinder.Find(paths)
	if err != nil {
		return nil, err
	}

	return l.loadPlugins(ctx, class, pluginJSONPaths)
}

func (l *Loader) loadPlugins(ctx context.Context, class plugins.Class, pluginJSONPaths []string) ([]*plugins.Plugin, error) {
	var foundPlugins = foundPlugins{}

	// load plugin.json files and map directory to JSON data
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			l.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "err", err)
			continue
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			l.log.Warn("Skipping plugin loading as absolute plugin.json path could not be calculated", "pluginID", plugin.ID, "err", err)
			continue
		}

		if _, dupe := foundPlugins[filepath.Dir(pluginJSONAbsPath)]; dupe {
			l.log.Warn("Skipping plugin loading as it's a duplicate", "pluginID", plugin.ID)
			continue
		}
		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	// get all registered plugins
	registeredPlugins := make(map[string]struct{})
	for _, p := range l.pluginRegistry.Plugins(ctx) {
		registeredPlugins[p.ID] = struct{}{}
	}

	foundPlugins.stripDuplicates(registeredPlugins, l.log)

	loadedPlugins := make(map[string]*plugins.Plugin)
	for pluginDir, pluginJSON := range foundPlugins {
		// Make sure that load CDN plugins only if they are external, otherwise disable CDN for this plugin
		isCDN := l.cfg.PluginSettings[pluginJSON.ID]["cdn"] != ""
		if class != plugins.External && isCDN {
			l.log.Warn(
				"Tried to load a non-external plugin as CDN, disabling CDN for this plugin",
				"pluginID", pluginJSON.ID, "class", class,
			)
			isCDN = false
		}
		plugin, err := createPluginBase(pluginJSON, class, pluginDir, isCDN, l.cfg.PluginsCDNBasePath)
		if err != nil {
			l.log.Warn("Could not create plugin base", "pluginID", pluginJSON.Info)
			continue
		}

		// calculate initial signature state
		sig, err := signature.Calculate(l.log, plugin)
		if err != nil {
			l.log.Warn("Could not calculate plugin signature state", "pluginID", plugin.ID, "err", err)
			continue
		}
		plugin.Signature = sig.Status
		plugin.SignatureType = sig.Type
		plugin.SignatureOrg = sig.SigningOrg

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

		if plugin.IsApp() {
			setDefaultNavURL(plugin)
		}

		if plugin.Parent != nil && plugin.Parent.IsApp() {
			configureAppChildPlugin(plugin.Parent, plugin)
		}

		verifiedPlugins = append(verifiedPlugins, plugin)
	}

	for _, p := range verifiedPlugins {
		err := l.pluginInitializer.Initialize(ctx, p)
		if err != nil {
			return nil, err
		}
		metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))

		if errDeclareRoles := l.roleRegistry.DeclarePluginRoles(ctx, p.ID, p.Name, p.Roles); errDeclareRoles != nil {
			l.log.Warn("Declare plugin roles failed.", "pluginID", p.ID, "path", p.PluginDir, "error", errDeclareRoles)
		}
	}

	for _, p := range verifiedPlugins {
		if err := l.load(ctx, p); err != nil {
			l.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}
	}

	return verifiedPlugins, nil
}

func (l *Loader) Unload(ctx context.Context, pluginID string) error {
	plugin, exists := l.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return plugins.ErrPluginNotInstalled
	}

	if !plugin.IsExternalPlugin() {
		return plugins.ErrUninstallCorePlugin
	}

	if err := l.unload(ctx, plugin); err != nil {
		return err
	}
	return nil
}

func (l *Loader) load(ctx context.Context, p *plugins.Plugin) error {
	if err := l.pluginRegistry.Add(ctx, p); err != nil {
		return err
	}

	if !p.IsCorePlugin() {
		l.log.Info("Plugin registered", "pluginID", p.ID)
	}

	if p.IsExternalPlugin() {
		if err := l.pluginStorage.Register(ctx, p.ID, p.PluginDir); err != nil {
			return err
		}
	}

	return l.processManager.Start(ctx, p.ID)
}

func (l *Loader) unload(ctx context.Context, p *plugins.Plugin) error {
	l.log.Debug("Stopping plugin process", "pluginId", p.ID)

	// TODO confirm the sequence of events is safe
	if err := l.processManager.Stop(ctx, p.ID); err != nil {
		return err
	}

	if err := l.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}
	l.log.Debug("Plugin unregistered", "pluginId", p.ID)

	if err := l.pluginStorage.Remove(ctx, p.ID); err != nil {
		return err
	}
	return nil
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
	if err = json.NewDecoder(reader).Decode(&plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if err = reader.Close(); err != nil {
		l.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
	}

	if err = validatePluginJSON(plugin); err != nil {
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
			include.Role = org.RoleViewer
		}
	}

	return plugin, nil
}

func createPluginBase(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string, isCDN bool, cdnBasePath string) (*plugins.Plugin, error) {
	baseURL, err := baseURL(pluginJSON, class, pluginDir, isCDN, cdnBasePath)
	if err != nil {
		return nil, fmt.Errorf("base url: %w", err)
	}
	moduleURL, err := module(pluginJSON, class, pluginDir, isCDN, cdnBasePath)
	if err != nil {
		return nil, fmt.Errorf("module url: %w", err)
	}
	plugin := &plugins.Plugin{
		JSONData:  pluginJSON,
		PluginDir: pluginDir,
		BaseURL:   baseURL,
		Module:    moduleURL,
		Class:     class,
		CDN:       isCDN,
	}

	plugin.SetLogger(log.New(fmt.Sprintf("plugin.%s", plugin.ID)))
	if err := setImages(plugin, cdnBasePath); err != nil {
		return nil, fmt.Errorf("set images: %w", err)
	}

	return plugin, nil
}

func setImages(p *plugins.Plugin, cdnBaseURL string) error {
	if p.CDN {
		u, err := cdnPluginLogoURL(p.Type, p.Info.Logos.Small, cdnBaseURL, p.ID, p.Info.Version)
		if err != nil {
			return fmt.Errorf("cdn plugin small logo url: %w", err)
		}
		p.Info.Logos.Small = u

		u, err = cdnPluginLogoURL(p.Type, p.Info.Logos.Large, cdnBaseURL, p.ID, p.Info.Version)
		if err != nil {
			return fmt.Errorf("cdn plugin large logo url: %w", err)
		}
		p.Info.Logos.Large = u
	} else {
		p.Info.Logos.Small = pluginLogoURL(p.Type, p.Info.Logos.Small, p.BaseURL)
		p.Info.Logos.Large = pluginLogoURL(p.Type, p.Info.Logos.Large, p.BaseURL)
	}

	for i := 0; i < len(p.Info.Screenshots); i++ {
		var path string
		var err error
		screenshot := &p.Info.Screenshots[i]
		if p.CDN {
			path, err = evalCDNPluginURLPath(screenshot.Path, cdnBaseURL, p.ID, p.Info.Version)
			if err != nil {
				return fmt.Errorf("screenshot %d eval cdn plugin path: %w", i, err)
			}
		} else {
			path = evalRelativePluginURLPath(screenshot.Path, p.BaseURL, p.Type)
		}
		screenshot.Path = path
	}
	return nil
}

func setDefaultNavURL(p *plugins.Plugin) {
	// slugify pages
	for _, include := range p.Includes {
		if include.Slug == "" {
			include.Slug = slugify.Slugify(include.Name)
		}

		if !include.DefaultNav {
			continue
		}

		if include.Type == "page" {
			p.DefaultNavURL = path.Join("/plugins/", p.ID, "/page/", include.Slug)
		}
		if include.Type == "dashboard" {
			dboardURL := include.DashboardURLPath()
			if dboardURL == "" {
				p.Logger().Warn("Included dashboard is missing a UID field")
				continue
			}

			p.DefaultNavURL = dboardURL
		}
	}
}

func configureAppChildPlugin(parent *plugins.Plugin, child *plugins.Plugin) {
	if !parent.IsApp() {
		return
	}
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

func cdnPluginLogoURL(pluginType plugins.Type, path, cdnBaseURL, pluginID, pluginVersion string) (string, error) {
	if path == "" {
		return defaultLogoPath(pluginType), nil
	}
	return evalCDNPluginURLPath(path, cdnBaseURL, pluginID, pluginVersion)
}

func evalCDNPluginURLPath(path string, cdnBaseURL, pluginID, pluginVersion string) (string, error) {
	return pluginscdn.NewCDNURLConstructor(cdnBaseURL, pluginID, pluginVersion).StringURLFor(path)
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

func baseURL(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string, isCDN bool, cdnBaseURL string) (string, error) {
	if class == plugins.Core {
		return path.Join("public/app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir)), nil
	}
	if isCDN {
		u, err := pluginscdn.NewCDNURLConstructor(
			cdnBaseURL, pluginJSON.ID, pluginJSON.Info.Version,
		).StringURLFor("")
		if err != nil {
			return "", err
		}
		return pluginscdn.RelativeURLForSystemJS(u), nil
	}
	return path.Join("public/plugins", pluginJSON.ID), nil
}

func module(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string, isCDN bool, cdnBaseURL string) (string, error) {
	if class == plugins.Core {
		return path.Join("app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir), "module"), nil
	}
	if isCDN {
		u, err := pluginscdn.NewCDNURLConstructor(
			cdnBaseURL, pluginJSON.ID, pluginJSON.Info.Version,
		).StringURLFor("module")
		if err != nil {
			return "", err
		}
		return pluginscdn.RelativeURLForSystemJS(u), nil
	}
	return path.Join("plugins", pluginJSON.ID, "module"), nil
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
