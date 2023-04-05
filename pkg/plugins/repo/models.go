package repo

import (
	"archive/zip"
	"fmt"
)

type PluginArchive struct {
	File *zip.ReadCloser
}

type PluginDownloadOptions struct {
	PluginZipURL string
	Version      string
	Checksum     string
}

type Plugin struct {
	ID       string    `json:"id"`
	Category string    `json:"category"`
	Versions []Version `json:"versions"`
}

type Version struct {
	Commit  string              `json:"commit"`
	URL     string              `json:"repoURL"`
	Version string              `json:"version"`
	Arch    map[string]ArchMeta `json:"arch"`
}

type ArchMeta struct {
	SHA256 string `json:"sha256"`
}

type PluginRepo struct {
	Plugins []Plugin `json:"plugins"`
	Version string   `json:"version"`
}

type Response4xxError struct {
	Message    string
	StatusCode int
	SystemInfo string
}

func (e Response4xxError) Error() string {
	if len(e.Message) > 0 {
		if len(e.SystemInfo) > 0 {
			return fmt.Sprintf("%s (%s)", e.Message, e.SystemInfo)
		}
		return fmt.Sprintf("%d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("%d", e.StatusCode)
}

type ErrArchUnsupported struct {
	PluginID   string
	SystemInfo string
}

func (e ErrArchUnsupported) Error() string {
	return fmt.Sprintf("%s is not compatible with your system architecture: %s", e.PluginID, e.SystemInfo)
}

type ErrVersionUnsupported struct {
	PluginID         string
	RequestedVersion string
	SystemInfo       string
}

func (e ErrVersionUnsupported) Error() string {
	return fmt.Sprintf("%s v%s is not supported on your system (%s)", e.PluginID, e.RequestedVersion, e.SystemInfo)
}

type ErrVersionNotFound struct {
	PluginID         string
	RequestedVersion string
	SystemInfo       string
}

func (e ErrVersionNotFound) Error() string {
	return fmt.Sprintf("%s v%s either does not exist or is not supported on your system (%s)", e.PluginID, e.RequestedVersion, e.SystemInfo)
}
