package repo

import (
	"errors"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/log"
)

type VersionData struct {
	Version  string
	Checksum string
	Arch     map[string]ArchMeta
	URL      string
}

// SelectSystemCompatibleVersion selects the most appropriate plugin version based on os + architecture
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func SelectSystemCompatibleVersion(log log.PrettyLogger, versions []Version, pluginID, version string, compatOpts CompatOpts) (VersionData, error) {
	version = normalizeVersion(version)

	sysCompatOpts, exists := compatOpts.System()
	if !exists {
		return VersionData{}, errors.New("no system compatibility requirements set")
	}

	versions = filterCompatibleVersions(versions)
	if len(versions) == 0 {
		return VersionData{}, ErrNoCompatibleVersions(pluginID, compatOpts.grafanaVersion)
	}

	var ver Version
	latestForArch, exists := latestSupportedVersionForArch(versions, sysCompatOpts)
	if !exists {
		return VersionData{}, ErrArcNotFound(pluginID, sysCompatOpts.OSAndArch())
	}

	if version == "" {
		return VersionData{
			Version:  latestForArch.Version,
			Checksum: checksum(latestForArch, sysCompatOpts),
			Arch:     latestForArch.Arch,
			URL:      latestForArch.URL,
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
		return VersionData{}, ErrVersionNotFound(pluginID, version, sysCompatOpts.OSAndArch())
	}

	if !supportsCurrentArch(ver, sysCompatOpts) {
		log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionUnsupported(pluginID, version, sysCompatOpts.OSAndArch())
	}

	return VersionData{
		Version:  ver.Version,
		Checksum: checksum(ver, sysCompatOpts),
		Arch:     ver.Arch,
		URL:      ver.URL,
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

func filterCompatibleVersions(versions []Version) []Version {
	return slices.DeleteFunc(versions, func(v Version) bool {
		return !v.IsCompatible
	})
}

func latestSupportedVersionForArch(versions []Version, compatOpts SystemCompatOpts) (Version, bool) {
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
