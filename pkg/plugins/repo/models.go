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

// PluginRepo is (a subset of) the JSON response from /api/plugins/repo/$pluginID
type PluginRepo struct {
	Versions []Version `json:"versions"`
}

type Version struct {
	Version string              `json:"version"`
	Arch    map[string]ArchMeta `json:"arch"`
}

type ArchMeta struct {
	SHA256 string `json:"sha256"`
}
