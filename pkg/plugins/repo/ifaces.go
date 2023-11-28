package repo

import (
	"context"
	"fmt"
	"strings"
)

// Service is responsible for retrieving plugin archive information from a repository.
type Service interface {
	// GetPluginArchive fetches the requested plugin archive.
	GetPluginArchive(ctx context.Context, pluginID, version string, opts CompatOpts) (*PluginArchive, error)
	// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
	GetPluginArchiveByURL(ctx context.Context, archiveURL string, opts CompatOpts) (*PluginArchive, error)
	// GetPluginArchiveInfo fetches information needed for downloading the requested plugin.
	GetPluginArchiveInfo(ctx context.Context, pluginID, version string, opts CompatOpts) (*PluginArchiveInfo, error)
}

type CompatOpts struct {
	grafanaVersion string
	system         SystemCompatOpts
}

type SystemCompatOpts struct {
	os   string
	arch string
}

func (co CompatOpts) GrafanaVersion() (string, bool) {
	if len(co.grafanaVersion) > 0 {
		return co.grafanaVersion, true
	}
	return "", false
}

func (co CompatOpts) System() (SystemCompatOpts, bool) {
	os, osSet := co.system.OS()
	arch, archSet := co.system.Arch()
	if !osSet || !archSet {
		return SystemCompatOpts{}, false
	}
	return SystemCompatOpts{os: os, arch: arch}, true
}

func (co SystemCompatOpts) OS() (string, bool) {
	if len(co.os) > 0 {
		return co.os, true
	}
	return "", false
}

func (co SystemCompatOpts) Arch() (string, bool) {
	if len(co.arch) > 0 {
		return co.arch, true
	}
	return "", false
}

func NewCompatOpts(grafanaVersion, os, arch string) CompatOpts {
	return CompatOpts{
		grafanaVersion: grafanaVersion,
		system: SystemCompatOpts{
			os:   os,
			arch: arch,
		},
	}
}

func NewSystemCompatOpts(os, arch string) CompatOpts {
	return CompatOpts{
		system: SystemCompatOpts{
			os:   os,
			arch: arch,
		},
	}
}

func (co SystemCompatOpts) OSAndArch() string {
	if os, exists := co.OS(); !exists {
		return ""
	} else if arch, exists := co.Arch(); !exists {
		return ""
	} else {
		return fmt.Sprintf("%s-%s", strings.ToLower(os), arch)
	}
}

func (co CompatOpts) String() string {
	grafanaVersion, exists := co.GrafanaVersion()
	if !exists {
		return co.system.OSAndArch()
	}

	return fmt.Sprintf("Grafana v%s %s", grafanaVersion, co.system.OSAndArch())
}
