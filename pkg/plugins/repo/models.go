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
	Version           string              `json:"version"`
	Arch              map[string]ArchMeta `json:"packages"`
	URL               string              `json:"url"`
	CreatedAt         string              `json:"createdAt"`
	IsCompatible      *bool               `json:"isCompatible,omitempty"`
	GrafanaDependency string              `json:"grafanaDependency"`
}

type ArchMeta struct {
	SHA256      string `json:"sha256"`
	MD5         string `json:"md5"`
	PackageName string `json:"packageName"`
	DownloadURL string `json:"downloadUrl"`
}

// PluginInfo is (a subset of) the JSON response from grafana.com/api/plugins/$pluginID
type PluginInfo struct {
	ID      int    `json:"id"`
	Status  string `json:"status"`
	Slug    string `json:"slug"`
	Version string `json:"version"`
}
