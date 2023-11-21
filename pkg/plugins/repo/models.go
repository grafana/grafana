package repo

import (
	"archive/zip"

	"github.com/grafana/grafana/pkg/plugins"
)

type PluginArchive struct {
	File *zip.ReadCloser
}

type PluginArchiveInfo struct {
	URL      string
	Version  string
	Checksum string
}

// PluginVersions is the JSON response from /api/plugins/$pluginID/versions
type PluginVersions struct {
	Versions []Version `json:"items"`
}

type Version struct {
	Version string              `json:"version"`
	Arch    map[string]ArchMeta `json:"packages"`
	URL     string              `json:"url"`
}

type ArchMeta struct {
	SHA256 string `json:"sha256"`
}

// PluginInfo is (a subset of) the JSON response from /api/plugins/$pluginID/versions/$version
type PluginInfo struct {
	JSONData plugins.JSONData `json:"json"`
}
