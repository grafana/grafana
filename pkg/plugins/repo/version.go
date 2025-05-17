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

	var ver Version
	latestForArch, err := latestSupportedVersion(pluginID, versions, compatOpts)
	if err != nil {
		return VersionData{}, err
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
		if normalizeVersion(v.Version) == version {
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

func latestSupportedVersion(pluginID string, versions []Version, compatOpts CompatOpts) (Version, error) {
	// First check if the version are compatible with the current Grafana version
	versions = slices.DeleteFunc(versions, func(v Version) bool {
		return v.IsCompatible != nil && !*v.IsCompatible
	})
	if len(versions) == 0 {
		return Version{}, ErrNoCompatibleVersions(pluginID, compatOpts.grafanaVersion)
	}

	// Then check if the version are compatible with the current system
	for _, v := range versions {
		if supportsCurrentArch(v, compatOpts.system) {
			return v, nil
		}
	}
	return Version{}, ErrArcNotFound(pluginID, compatOpts.system.OSAndArch())
}

func normalizeVersion(version string) string {
	normalized := strings.ReplaceAll(version, " ", "")
	if strings.HasPrefix(normalized, "^") || strings.HasPrefix(normalized, "v") {
		return normalized[1:]
	}

	return normalized
}
