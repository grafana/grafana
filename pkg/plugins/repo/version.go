package repo

import (
	"strings"

	"github.com/grafana/grafana/pkg/plugins/log"
)

type VersionData struct {
	Version  string
	Checksum string
}

// SelectSystemCompatibleVersion selects the most appropriate plugin version based on os + architecture
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func SelectSystemCompatibleVersion(log log.PrettyLogger, versions []Version, pluginID, version string, compatOpts SystemCompatOpts) (VersionData, error) {
	version = normalizeVersion(version)

	var ver Version
	latestForArch, exists := latestSupportedVersion(versions, compatOpts)
	if !exists {
		return VersionData{}, ErrArcNotFound{
			pluginID:   pluginID,
			systemInfo: compatOpts.OSAndArch(),
		}
	}

	if version == "" {
		return VersionData{
			Version:  latestForArch.Version,
			Checksum: checksum(latestForArch, compatOpts),
		}, nil
	}
	for _, v := range versions {
		if v.Version == version {
			ver = v
			break
		}
	}

	if len(ver.Version) == 0 {
		log.Debugf("Requested plugin version %s v%s not found but potential fallback version '%s' was found",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionNotFound{
			pluginID:         pluginID,
			requestedVersion: version,
			systemInfo:       compatOpts.OSAndArch(),
		}
	}

	if !supportsCurrentArch(ver, compatOpts) {
		log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionUnsupported{
			pluginID:         pluginID,
			requestedVersion: version,
			systemInfo:       compatOpts.OSAndArch(),
		}
	}

	return VersionData{
		Version:  ver.Version,
		Checksum: checksum(ver, compatOpts),
	}, nil
}

func checksum(v Version, compatOpts SystemCompatOpts) string {
	if v.Arch != nil {
		archMeta, exists := v.Arch[compatOpts.OSAndArch()]
		if !exists {
			archMeta = v.Arch["any"]
		}
		return archMeta.SHA256
	}
	return ""
}

func supportsCurrentArch(version Version, compatOpts SystemCompatOpts) bool {
	if version.Arch == nil {
		return true
	}
	for arch := range version.Arch {
		if arch == compatOpts.OSAndArch() || arch == "any" {
			return true
		}
	}
	return false
}

func latestSupportedVersion(versions []Version, compatOpts SystemCompatOpts) (Version, bool) {
	for _, v := range versions {
		if supportsCurrentArch(v, compatOpts) {
			return v, true
		}
	}
	return Version{}, false
}

func normalizeVersion(version string) string {
	normalized := strings.ReplaceAll(version, " ", "")
	if strings.HasPrefix(normalized, "^") || strings.HasPrefix(normalized, "v") {
		return normalized[1:]
	}

	return normalized
}
