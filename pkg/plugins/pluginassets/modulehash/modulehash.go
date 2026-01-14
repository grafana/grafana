package modulehash

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"path"
	"path/filepath"
	"sync"

	"github.com/Masterminds/semver/v3"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

const (
	CreatePluginVersionCfgKey               = "create_plugin_version"
	CreatePluginVersionScriptSupportEnabled = "4.15.0"
)

var (
	scriptLoadingMinSupportedVersion = semver.MustParse(CreatePluginVersionScriptSupportEnabled)
)

type ModuleHashCalculator struct {
	reg       registry.Service
	cfg       *config.PluginManagementCfg
	cdn       *pluginscdn.Service
	signature *signature.Signature
	log       log.Logger

	moduleHashCache sync.Map
}

func NewModuleHashCalculator(cfg *config.PluginManagementCfg, reg registry.Service, cdn *pluginscdn.Service, signature *signature.Signature) *ModuleHashCalculator {
	return &ModuleHashCalculator{
		cfg:       cfg,
		reg:       reg,
		cdn:       cdn,
		signature: signature,
		log:       log.New("modulehash"),
	}
}

// ModuleHash returns the module.js SHA256 hash for a plugin in the format expected by the browser for SRI checks.
// The module hash is read from the plugin's MANIFEST.txt file.
// The plugin can also be a nested plugin.
// If the plugin is unsigned, an empty string is returned.
// The results are cached to avoid repeated reads from the MANIFEST.txt file.
func (c *ModuleHashCalculator) ModuleHash(ctx context.Context, pluginID, pluginVersion string) string {
	p, ok := c.reg.Plugin(ctx, pluginID, pluginVersion)
	if !ok {
		c.log.Error("Failed to calculate module hash as plugin is not registered", "pluginId", pluginID)
		return ""
	}
	k := c.moduleHashCacheKey(pluginID, pluginVersion)
	cachedValue, ok := c.moduleHashCache.Load(k)
	if ok {
		return cachedValue.(string)
	}
	mh, err := c.moduleHash(ctx, p, "")
	if err != nil {
		c.log.Error("Failed to calculate module hash", "pluginId", p.ID, "error", err)
	}
	c.moduleHashCache.Store(k, mh)
	return mh
}

// moduleHash is the underlying function for ModuleHash. See its documentation for more information.
// If the plugin is not a CDN plugin, the function will return an empty string.
// It will read the module hash from the MANIFEST.txt in the [[plugins.FS]] of the provided plugin.
// If childFSBase is provided, the function will try to get the hash from MANIFEST.txt for the provided children's
// module.js file, rather than for the provided plugin.
func (c *ModuleHashCalculator) moduleHash(ctx context.Context, p *plugins.Plugin, childFSBase string) (r string, err error) {
	if !c.cfg.Features.SriChecksEnabled {
		return "", nil
	}

	// Ignore unsigned plugins
	if !p.Signature.IsValid() {
		return "", nil
	}

	if p.Parent != nil {
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
			childFSBase = p.FS.Base()
		}
		return c.moduleHash(ctx, p.Parent, childFSBase)
	}

	// Only CDN plugins are supported for SRI checks.
	// CDN plugins have the version as part of the URL, which acts as a cache-buster.
	// Needed due to: https://github.com/grafana/plugin-tools/pull/1426
	// FS plugins build before this change will have SRI mismatch issues.
	if !c.cdnEnabled(p.ID, p.FS) {
		return "", nil
	}

	manifest, err := c.signature.ReadPluginManifestFromFS(ctx, p.FS)
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

func (c *ModuleHashCalculator) compatibleCreatePluginVersion(ps map[string]string) bool {
	if cpv, ok := ps[CreatePluginVersionCfgKey]; ok {
		createPluginVer, err := semver.NewVersion(cpv)
		if err != nil {
			c.log.Warn("Failed to parse create plugin version setting as semver", "version", cpv, "error", err)
		} else {
			if !createPluginVer.LessThan(scriptLoadingMinSupportedVersion) {
				return true
			}
		}
	}
	return false
}

func (c *ModuleHashCalculator) cdnEnabled(pluginID string, fs plugins.FS) bool {
	return c.cdn.PluginSupported(pluginID) || fs.Type().CDN()
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
func (c *ModuleHashCalculator) moduleHashCacheKey(pluginId, pluginVersion string) string {
	return pluginId + ":" + pluginVersion
}
