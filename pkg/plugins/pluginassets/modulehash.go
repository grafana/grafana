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
// For nested plugins, the module hash is read from the parent plugin's manifest.
// If the plugin is unsigned or not a CDN plugin, an empty string is returned.
func CalculateModuleHash(p *plugins.Plugin, cfg *config.PluginManagementCfg, cdn *pluginscdn.Service) string {
	if cfg == nil || !cfg.Features.SriChecksEnabled {
		return ""
	}

	// Ignore unsigned plugins
	if !p.Signature.IsValid() {
		return ""
	}

	// For nested plugins, use the parent's manifest
	var manifest *plugins.PluginManifest
	var childPath string
	if p.Parent != nil {
		if p.Parent.Manifest == nil {
			return ""
		}
		manifest = p.Parent.Manifest
		// Calculate the relative path of the child plugin folder from the parent plugin folder
		var err error
		childPath, err = p.FS.Rel(p.Parent.FS.Base())
		if err != nil {
			return ""
		}
		// MANIFEST.txt uses forward slashes as path separators
		childPath = filepath.ToSlash(childPath)
	} else {
		if p.Manifest == nil {
			return ""
		}
		manifest = p.Manifest
	}

	if !manifest.IsV2() {
		return ""
	}

	// Only CDN plugins are supported for SRI checks
	if !cdnEnabled(p, cdn) {
		return ""
	}

	moduleHash, ok := manifest.Files[path.Join(childPath, "module.js")]
	if !ok {
		return ""
	}

	return convertHashForSRI(moduleHash)
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
