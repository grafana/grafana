package pluginassets

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"path"
	"path/filepath"
	"sync"

	"github.com/Masterminds/semver/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	CreatePluginVersionCfgKey               = "create_plugin_version"
	CreatePluginVersionScriptSupportEnabled = "4.15.0"
)

var (
	scriptLoadingMinSupportedVersion = semver.MustParse(CreatePluginVersionScriptSupportEnabled)
)

func ProvideService(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service, sig *signature.Signature, store pluginstore.Store) *Service {
	return &Service{
		cfg:       cfg,
		cdn:       cdn,
		signature: sig,
		store:     store,
		log:       log.New("pluginassets"),
	}
}

type Service struct {
	cfg       *config.PluginManagementCfg
	cdn       *pluginscdn.Service
	signature *signature.Signature
	store     pluginstore.Store
	log       log.Logger

	moduleHashCache sync.Map
}

// LoadingStrategy calculates the loading strategy for a plugin.
// If a plugin has plugin setting `create_plugin_version` >= 4.15.0, set loadingStrategy to "script".
// If a plugin is not loaded via the CDN and is not Angular, set loadingStrategy to "script".
// Otherwise, set loadingStrategy to "fetch".
func (s *Service) LoadingStrategy(_ context.Context, p pluginstore.Plugin) plugins.LoadingStrategy {
	if pCfg, ok := s.cfg.PluginSettings[p.ID]; ok {
		if s.compatibleCreatePluginVersion(pCfg) {
			return plugins.LoadingStrategyScript
		}
	}

	// If the plugin has a parent
	if p.Parent != nil {
		// Check the parent's create_plugin_version setting
		if pCfg, ok := s.cfg.PluginSettings[p.Parent.ID]; ok {
			if s.compatibleCreatePluginVersion(pCfg) {
				return plugins.LoadingStrategyScript
			}
		}

		// Since the parent plugin is not explicitly configured as script loading compatible,
		// If the plugin is either loaded from the CDN (via its parent) or contains Angular, we should use fetch
		if s.cdnEnabled(p.Parent.ID, p.Class) || p.Angular.Detected {
			return plugins.LoadingStrategyFetch
		}
	}

	if !s.cdnEnabled(p.ID, p.Class) && !p.Angular.Detected {
		return plugins.LoadingStrategyScript
	}

	return plugins.LoadingStrategyFetch
}

// ModuleHash returns the module.js SHA256 hash for a plugin in the format expected by the browser for SRI checks.
// The module hash is read from the plugin's MANIFEST.txt file.
// The plugin can also be a nested plugin.
// If the plugin is unsigned, an empty string is returned.
// The results are cached to avoid repeated reads from the MANIFEST.txt file.
func (s *Service) ModuleHash(ctx context.Context, p pluginstore.Plugin) string {
	k := s.moduleHashCacheKey(p)
	cachedValue, ok := s.moduleHashCache.Load(k)
	if ok {
		return cachedValue.(string)
	}
	mh, err := s.moduleHash(ctx, p, "")
	if err != nil {
		s.log.Error("Failed to calculate module hash", "plugin", p.ID, "error", err)
	}
	s.moduleHashCache.Store(k, mh)
	return mh
}

// moduleHash is the underlying function for ModuleHash. See its documentation for more information.
// If the plugin is not a CDN plugin, the function will return an empty string.
// It will read the module hash from the MANIFEST.txt in the [[plugins.FS]] of the provided plugin.
// If childFSBase is provided, the function will try to get the hash from MANIFEST.txt for the provided children's
// module.js file, rather than for the provided plugin.
func (s *Service) moduleHash(ctx context.Context, p pluginstore.Plugin, childFSBase string) (r string, err error) {
	if !s.cfg.Features.SriChecksEnabled {
		return "", nil
	}

	// Ignore unsigned plugins
	if !p.Signature.IsValid() {
		return "", nil
	}

	if p.Parent != nil {
		// Nested plugin
		parent, ok := s.store.Plugin(ctx, p.Parent.ID)
		if !ok {
			return "", fmt.Errorf("parent plugin plugin %q for child plugin %q not found", p.Parent.ID, p.ID)
		}

		// The module hash is contained within the parent's MANIFEST.txt file.
		// For example, the parent's MANIFEST.txt will contain an entry similar to this:
		//
		// ```
		// "datasource/module.js": "1234567890abcdef..."
		// ```
		//
		// Recursively call moduleHash with the parent plugin and with the children plugin folder path
		// to get the correct module hash for the nested plugin.
		if childFSBase == "" {
			childFSBase = p.Base()
		}
		return s.moduleHash(ctx, parent, childFSBase)
	}

	// Only CDN plugins are supported for SRI checks.
	// CDN plugins have the version as part of the URL, which acts as a cache-buster.
	// Needed due to: https://github.com/grafana/plugin-tools/pull/1426
	// FS plugins build before this change will have SRI mismatch issues.
	if !s.cdnEnabled(p.ID, p.Class) {
		return "", nil
	}

	manifest, err := s.signature.ReadPluginManifestFromFS(ctx, p.FS)
	if err != nil {
		return "", fmt.Errorf("read plugin manifest: %w", err)
	}
	if !manifest.IsV2() {
		return "", nil
	}

	var childPath string
	if childFSBase != "" {
		// Calculate the relative path of the child plugin folder from the parent plugin folder.
		childPath, err = p.FS.Rel(childFSBase)
		if err != nil {
			return "", fmt.Errorf("rel path: %w", err)
		}
		// MANIFETS.txt uses forward slashes as path separators.
		childPath = filepath.ToSlash(childPath)
	}
	moduleHash, ok := manifest.Files[path.Join(childPath, "module.js")]
	if !ok {
		return "", nil
	}
	return convertHashForSRI(moduleHash)
}

func (s *Service) compatibleCreatePluginVersion(ps map[string]string) bool {
	if cpv, ok := ps[CreatePluginVersionCfgKey]; ok {
		createPluginVer, err := semver.NewVersion(cpv)
		if err != nil {
			s.log.Warn("Failed to parse create plugin version setting as semver", "version", cpv, "error", err)
		} else {
			if !createPluginVer.LessThan(scriptLoadingMinSupportedVersion) {
				return true
			}
		}
	}
	return false
}

func (s *Service) cdnEnabled(pluginID string, class plugins.Class) bool {
	return s.cdn.PluginSupported(pluginID) || class == plugins.ClassCDN
}

// convertHashForSRI takes a SHA256 hash string and returns it as expected by the browser for SRI checks.
func convertHashForSRI(h string) (string, error) {
	hb, err := hex.DecodeString(h)
	if err != nil {
		return "", fmt.Errorf("hex decode string: %w", err)
	}
	return "sha256-" + base64.StdEncoding.EncodeToString(hb), nil
}

// moduleHashCacheKey returns a unique key for the module hash cache.
func (s *Service) moduleHashCacheKey(p pluginstore.Plugin) string {
	return p.ID + ":" + p.Info.Version
}
