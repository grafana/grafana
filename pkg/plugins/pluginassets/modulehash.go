package pluginassets

import (
	"encoding/base64"
	"encoding/hex"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

// CalculateModuleHash calculates the module.js SHA256 hash for a plugin in the format expected by the browser for SRI checks.
// The module hash is read from the plugin's cached manifest.
// For nested plugins, the module hash is read from the root parent plugin's manifest.
// If the plugin is unsigned or not a CDN plugin, an empty string is returned.
func CalculateModuleHash(p *plugins.Plugin, cfg *config.PluginManagementCfg, cdn *pluginscdn.Service) string {
	if cfg == nil || !cfg.Features.SriChecksEnabled {
		return ""
	}

	if !p.Signature.IsValid() {
		return ""
	}

	rootParent := findRootParent(p)
	if rootParent.Manifest == nil {
		return ""
	}

	if !rootParent.Manifest.IsV2() {
		return ""
	}

	if !cdnEnabled(rootParent, cdn) {
		return ""
	}

	modulePath := getModulePathInManifest(p, rootParent)
	moduleHash, ok := rootParent.Manifest.Files[modulePath]
	if !ok {
		return ""
	}

	return convertHashForSRI(moduleHash)
}

// findRootParent returns the root parent plugin (the one that contains the manifest).
// For non-nested plugins, it returns the plugin itself.
func findRootParent(p *plugins.Plugin) *plugins.Plugin {
	root := p
	for root.Parent != nil {
		root = root.Parent
	}
	return root
}

// getModulePathInManifest returns the path to module.js as it appears in the manifest.
// For nested plugins, this is the relative path from the root parent to the plugin's module.js.
// For non-nested plugins, this is simply "module.js".
func getModulePathInManifest(p *plugins.Plugin, rootParent *plugins.Plugin) string {
	if p == rootParent {
		return "module.js"
	}

	// Calculate the relative path from root parent to this plugin
	relPath, err := rootParent.FS.Rel(p.FS.Base())
	if err != nil {
		return ""
	}

	// MANIFEST.txt uses forward slashes as path separators
	pluginRootPath := filepath.ToSlash(relPath)
	return path.Join(pluginRootPath, "module.js")
}

// convertHashForSRI takes a SHA256 hash string and returns it as expected by the browser for SRI checks.
func convertHashForSRI(h string) string {
	hb, err := hex.DecodeString(h)
	if err != nil {
		return ""
	}
	return "sha256-" + base64.StdEncoding.EncodeToString(hb)
}

// cdnEnabled checks if a plugin is loaded via CDN
func cdnEnabled(p *plugins.Plugin, cdn *pluginscdn.Service) bool {
	return p.FS.Type().CDN() || cdn.PluginSupported(p.ID)
}
