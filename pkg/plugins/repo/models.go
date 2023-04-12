package repo

import "archive/zip"

type PluginArchive struct {
	File *zip.ReadCloser
}

type PluginDownloadOptions struct {
	PluginZipURL string
	Version      string
	Checksum     string
}

// PluginRepo is (a subset of) the JSON response from /api/plugins/repo/$pluginID
type PluginRepo struct {
	Versions []Version `json:"version"`
}

type Version struct {
	Version string              `json:"version"`
	Arch    map[string]ArchMeta `json:"arch"`
}

type ArchMeta struct {
	SHA256 string `json:"sha256"`
}

// Plugin is (a subset of) the JSON response from /api/plugins/$pluginID
type Plugin struct {
	Status        string `json:"status"`
	ID            int    `json:"id"`
	Version       string `json:"version"`
	VersionStatus string `json:"versionStatus"`
}

// PluginVersion is (a subset of) the JSON response from /api/plugins/$pluginID/version/$version
type PluginVersion struct {
	Packages map[string]Package `json:"packages"`
}

type Package struct {
	Sha256      string `json:"sha256"`
	PackageName string `json:"packageName"`
	DownloadURL string `json:"downloadUrl"`
}
