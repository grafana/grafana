package repository

import (
	"context"
	"fmt"
	"strings"
)

// Service is responsible for retrieving plugin information from a repository.
type Service interface {
	// GetPluginArchive fetches the requested plugin archive.
	GetPluginArchive(ctx context.Context, pluginID, version string, opts CompatabilityOpts) (*PluginArchive, error)
	// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
	GetPluginArchiveByURL(ctx context.Context, archiveURL string, opts CompatabilityOpts) (*PluginArchive, error)
	// GetPluginDownloadOptions fetches information for downloading the requested plugin.
	GetPluginDownloadOptions(ctx context.Context, pluginID, version string, opts CompatabilityOpts) (*PluginDownloadOptions, error)
}

type CompatabilityOpts struct {
	GrafanaVersion string
	OS             string
	Arch           string
}

func (co CompatabilityOpts) OSAndArch() string {
	return fmt.Sprintf("%s-%s", strings.ToLower(co.OS), co.Arch)
}

func (co CompatabilityOpts) String() string {
	return fmt.Sprintf("Grafana v%s %s", co.GrafanaVersion, co.OSAndArch())
}
