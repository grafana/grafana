package repo

import "archive/zip"

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
