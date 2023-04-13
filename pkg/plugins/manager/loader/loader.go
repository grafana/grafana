package loader

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/util"
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
	assetPath          *assetpath.Service
	log                log.Logger
	cfg                *config.Cfg
	features           plugins.FeatureToggles

	errs       map[string]*plugins.SignatureError
	grafanaURL string
}

func ProvideService(cfg *config.Cfg, license plugins.Licensing, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service, backendProvider plugins.BackendFactoryProvider, pluginFinder finder.Finder,
	roleRegistry plugins.RoleRegistry, assetPath *assetpath.Service, features plugins.FeatureToggles) *Loader {
	return New(cfg, license, authorizer, pluginRegistry, backendProvider, process.NewManager(pluginRegistry),
		storage.FileSystem(log.NewPrettyLogger("loader.fs"), cfg.PluginsPath), roleRegistry, assetPath,
		pluginFinder, features)
}

func New(cfg *config.Cfg, license plugins.Licensing, authorizer plugins.PluginLoaderAuthorizer,
	pluginRegistry registry.Service, backendProvider plugins.BackendFactoryProvider,
	processManager process.Service, pluginStorage storage.Manager, roleRegistry plugins.RoleRegistry,
	assetPath *assetpath.Service, pluginFinder finder.Finder, features plugins.FeatureToggles) *Loader {
	return &Loader{
		pluginFinder:       pluginFinder,
		pluginRegistry:     pluginRegistry,
		pluginInitializer:  initializer.New(cfg, backendProvider, license),
		signatureValidator: signature.NewValidator(authorizer),
		processManager:     processManager,
		pluginStorage:      pluginStorage,
		features:           features,

		errs:         make(map[string]*plugins.SignatureError),
		log:          log.New("plugin.loader"),
		roleRegistry: roleRegistry,
		cfg:          cfg,
		assetPath:    assetPath,
		grafanaURL:   "https://grafana.com",
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	found, err := l.pluginFinder.Find(ctx, src)
	if err != nil {
		return nil, err
	}

	return l.loadPlugins(ctx, src, found)
}

func (l *Loader) getPublicKey(features plugins.FeatureToggles) (string, error) {
	// The fallback public key is used when the feature flag is not enabled.
	publicKeyText := `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org
	
xpMEXpTXXxMFK4EEACMEIwQBiOUQhvGbDLvndE0fEXaR0908wXzPGFpf0P0Z
HJ06tsq+0higIYHp7WTNJVEZtcwoYLcPRGaa9OQqbUU63BEyZdgAkPTz3RFd
5+TkDWZizDcaVFhzbDd500yTwexrpIrdInwC/jrgs7Zy/15h8KA59XXUkdmT
YB6TR+OA9RKME+dCJozNGUdyYWZhbmEgPGVuZ0BncmFmYW5hLmNvbT7CvAQQ
EwoAIAUCXpTXXwYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BAAoJEH5NDGpw
iGbnaWoCCQGQ3SQnCkRWrG6XrMkXOKfDTX2ow9fuoErN46BeKmLM4f1EkDZQ
Tpq3SE8+My8B5BIH3SOcBeKzi3S57JHGBdFA+wIJAYWMrJNIvw8GeXne+oUo
NzzACdvfqXAZEp/HFMQhCKfEoWGJE8d2YmwY2+3GufVRTI5lQnZOHLE8L/Vc
1S5MXESjzpcEXpTXXxIFK4EEACMEIwQBtHX/SD5Qm3v4V92qpaIZQgtTX0sT
cFPjYWAHqsQ1iENrYN/vg1wU3ADlYATvydOQYvkTyT/tbDvx2Fse8PL84MQA
YKKQ6AJ3gLVvmeouZdU03YoV4MYaT8KbnJUkZQZkqdz2riOlySNI9CG3oYmv
omjUAtzgAgnCcurfGLZkkMxlmY8DAQoJwqQEGBMKAAkFAl6U118CGwwACgkQ
fk0ManCIZuc0jAIJAVw2xdLr4ZQqPUhubrUyFcqlWoW8dQoQagwO8s8ubmby
KuLA9FWJkfuuRQr+O9gHkDVCez3aism7zmJBqIOi38aNAgjJ3bo6leSS2jR/
x5NqiKVi83tiXDPncDQYPymOnMhW0l7CVA7wj75HrFvvlRI/4MArlbsZ2tBn
N1c5v9v/4h6qeA==
=DNbR
-----END PGP PUBLIC KEY BLOCK-----
`
	if !features.IsEnabled("pluginsAPIManifestKey") {
		return publicKeyText, nil
	}

	var data struct {
		Items []struct {
			KeyID  string `json:"keyId"`
			Since  int64  `json:"since"`
			Public string `json:"public"`
		}
	}

	resp, err := http.Get(l.grafanaURL + "/api/plugins/ci/keys")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	if len(data.Items) == 0 {
		return "", errors.New("missing public key")
	}

	return data.Items[0].Public, nil
}

func (l *Loader) loadPlugins(ctx context.Context, src plugins.PluginSource, found []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
	var loadedPlugins []*plugins.Plugin

	publicKeyText, err := l.getPublicKey(l.features)
	if err != nil {
		return nil, fmt.Errorf("could not get public key: %w", err)
	}

	for _, p := range found {
		if _, exists := l.pluginRegistry.Plugin(ctx, p.Primary.JSONData.ID); exists {
			l.log.Warn("Skipping plugin loading as it's a duplicate", "pluginID", p.Primary.JSONData.ID)
			continue
		}

		sig, err := signature.Calculate(ctx, l.log, src, p.Primary, publicKeyText)
		if err != nil {
			l.log.Warn("Could not calculate plugin signature state", "pluginID", p.Primary.JSONData.ID, "err", err)
			continue
		}
		plugin, err := l.createPluginBase(p.Primary.JSONData, src.PluginClass(ctx), p.Primary.FS)
		if err != nil {
			l.log.Error("Could not create primary plugin base", "pluginID", p.Primary.JSONData.ID, "err", err)
			continue
		}

		plugin.Signature = sig.Status
		plugin.SignatureType = sig.Type
		plugin.SignatureOrg = sig.SigningOrg

		loadedPlugins = append(loadedPlugins, plugin)

		for _, c := range p.Children {
			if _, exists := l.pluginRegistry.Plugin(ctx, c.JSONData.ID); exists {
				l.log.Warn("Skipping plugin loading as it's a duplicate", "pluginID", p.Primary.JSONData.ID)
				continue
			}

			cp, err := l.createPluginBase(c.JSONData, plugin.Class, c.FS)
			if err != nil {
				l.log.Error("Could not create child plugin base", "pluginID", p.Primary.JSONData.ID, "err", err)
				continue
			}
			cp.Parent = plugin
			cp.Signature = sig.Status
			cp.SignatureType = sig.Type
			cp.SignatureOrg = sig.SigningOrg

			plugin.Children = append(plugin.Children, cp)

			loadedPlugins = append(loadedPlugins, cp)
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

		// verify module.js exists for SystemJS to load.
		// CDN plugins can be loaded with plugin.json only, so do not warn for those.
		if !plugin.IsRenderer() && !plugin.IsCorePlugin() {
			f, err := plugin.FS.Open("module.js")
			if err != nil {
				if errors.Is(err, plugins.ErrFileNotExist) {
					l.log.Warn("Plugin missing module.js", "pluginID", plugin.ID,
						"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.")
				}
			} else if f != nil {
				if err := f.Close(); err != nil {
					l.log.Warn("Could not close module.js", "pluginID", plugin.ID, "err", err)
				}
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

	// initialize plugins
	initializedPlugins := make([]*plugins.Plugin, 0)
	for _, p := range verifiedPlugins {
		err := l.pluginInitializer.Initialize(ctx, p)
		if err != nil {
			l.log.Error("Could not initialize plugin", "pluginId", p.ID, "err", err)
			continue
		}
		if errDeclareRoles := l.roleRegistry.DeclarePluginRoles(ctx, p.ID, p.Name, p.Roles); errDeclareRoles != nil {
			l.log.Warn("Declare plugin roles failed.", "pluginID", p.ID, "err", errDeclareRoles)
		}

		initializedPlugins = append(initializedPlugins, p)
	}

	for _, p := range initializedPlugins {
		if err := l.load(ctx, p); err != nil {
			l.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}

		if !p.IsCorePlugin() && !p.IsBundledPlugin() {
			metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))
		}
	}

	return initializedPlugins, nil
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
		if err := l.pluginStorage.Register(ctx, p.ID, p.FS.Base()); err != nil {
			return err
		}
	}

	return l.processManager.Start(ctx, p.ID)
}

func (l *Loader) unload(ctx context.Context, p *plugins.Plugin) error {
	l.log.Debug("Stopping plugin process", "pluginId", p.ID)

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

func (l *Loader) createPluginBase(pluginJSON plugins.JSONData, class plugins.Class, files plugins.FS) (*plugins.Plugin, error) {
	baseURL, err := l.assetPath.Base(pluginJSON, class, files.Base())
	if err != nil {
		return nil, fmt.Errorf("base url: %w", err)
	}
	moduleURL, err := l.assetPath.Module(pluginJSON, class, files.Base())
	if err != nil {
		return nil, fmt.Errorf("module url: %w", err)
	}
	plugin := &plugins.Plugin{
		JSONData: pluginJSON,
		FS:       files,
		BaseURL:  baseURL,
		Module:   moduleURL,
		Class:    class,
	}

	plugin.SetLogger(log.New(fmt.Sprintf("plugin.%s", plugin.ID)))
	if err := l.setImages(plugin); err != nil {
		return nil, err
	}

	return plugin, nil
}

func (l *Loader) setImages(p *plugins.Plugin) error {
	var err error
	for _, dst := range []*string{&p.Info.Logos.Small, &p.Info.Logos.Large} {
		*dst, err = l.assetPath.RelativeURL(p, *dst, defaultLogoPath(p.Type))
		if err != nil {
			return fmt.Errorf("logo: %w", err)
		}
	}
	for i := 0; i < len(p.Info.Screenshots); i++ {
		screenshot := &p.Info.Screenshots[i]
		screenshot.Path, err = l.assetPath.RelativeURL(p, screenshot.Path, "")
		if err != nil {
			return fmt.Errorf("screenshot %d relative url: %w", i, err)
		}
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
	appSubPath := strings.ReplaceAll(strings.Replace(child.FS.Base(), parent.FS.Base(), "", 1), "\\", "/")
	child.IncludedInAppID = parent.ID
	child.BaseURL = parent.BaseURL

	if parent.IsCorePlugin() {
		child.Module = util.JoinURLFragments("app/plugins/app/"+parent.ID, appSubPath) + "/module"
	} else {
		child.Module = util.JoinURLFragments("plugins/"+parent.ID, appSubPath) + "/module"
	}
}

func defaultLogoPath(pluginType plugins.Type) string {
	return "public/img/icn-" + string(pluginType) + ".svg"
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
