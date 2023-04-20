package repo

import (
	"context"
	"fmt"
	"strings"
)

// PluginArchiveGetter is responsible for retrieving plugin archive information from a repository.
type PluginArchiveGetter interface {
	// GetPluginArchive fetches the requested plugin archive.
	GetPluginArchive(ctx context.Context, pluginID, version string, opts CompatOpts) (*PluginArchive, error)
	// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
	GetPluginArchiveByURL(ctx context.Context, archiveURL string) (*PluginArchive, error)
}

type PluginArchiveInfoGetter interface {
	// GetPluginArchiveInfo fetches information needed for downloading the requested plugin.
	GetPluginArchiveInfo(ctx context.Context, pluginID, version string, opts CompatOpts) (*PluginDownloadOptions, error)
}

type CompatOpts struct {
	GrafanaVersion string
	OS             string
	Arch           string
}

func NewCompatOpts(grafanaVersion, os, arch string) CompatOpts {
	return CompatOpts{
		GrafanaVersion: grafanaVersion,
		OS:             os,
		Arch:           arch,
	}
}

func (co CompatOpts) OSAndArch() string {
	return fmt.Sprintf("%s-%s", strings.ToLower(co.OS), co.Arch)
}

func (co CompatOpts) String() string {
	return fmt.Sprintf("Grafana v%s %s", co.GrafanaVersion, co.OSAndArch())
}
