package repo

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/log"
)

type VersionData struct {
	Version  string
	Checksum string
	Arch     map[string]ArchMeta
	URL      string
}

// SelectSystemCompatibleVersion selects the most appropriate plugin version for
// the current Grafana version and OS/architecture.
//
//   - Returns the specified version when it's grafana-compatible and arch-compatible.
//   - Returns the latest grafana-compatible + arch-compatible version when no version
//     is specified.
//
// Errors:
//   - ErrVersionNotFound:      specified version not present in the catalog listing
//   - ErrVersionNotCompatible: specified version is incompatible with this Grafana version
//   - ErrVersionUnsupported:   specified version is grafana-compatible but not built for this OS/arch
//   - ErrNoCompatibleVersions: no version in the listing is compatible with this Grafana version
//   - ErrArcNotFound:          some versions are grafana-compatible but none for this OS/arch
//
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func SelectSystemCompatibleVersion(log log.PrettyLogger, versions []Version, pluginID, version string, compatOpts CompatOpts) (VersionData, error) {
	version = normalizeVersion(version)

	sysCompatOpts, exists := compatOpts.System()
	if !exists {
		return VersionData{}, errors.New("no system compatibility requirements set")
	}

	if err := validateCompatibility(pluginID, versions, compatOpts); err != nil {
		return VersionData{}, err
	}

	latestForArch := latestSupportedVersion(versions, compatOpts)

	if version == "" {
		return VersionData{
			Version:  latestForArch.Version,
			Checksum: checksum(latestForArch, sysCompatOpts),
			Arch:     latestForArch.Arch,
			URL:      latestForArch.URL,
		}, nil
	}

	var ver Version
	for _, v := range versions {
		if normalizeVersion(v.Version) == version {
			ver = v
			break
		}
	}

	if len(ver.Version) == 0 {
		log.Debugf("Requested plugin version %s v%s not found in catalog; latest available is '%s'",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionNotFound(pluginID, version)
	}

	if ver.IsCompatible != nil && !*ver.IsCompatible {
		runningGrafanaVersion, _ := compatOpts.GrafanaVersion()
		log.Debugf("Requested plugin version %s v%s is incompatible with this Grafana version; latest compatible is '%s'",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionNotCompatible(pluginID, version, runningGrafanaVersion)
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

// validateCompatibility reports why no compatible version can be found, or nil
// if at least one grafana-compatible + arch-compatible version exists in the listing.
func validateCompatibility(pluginID string, versions []Version, compatOpts CompatOpts) error {
	var hasGrafanaCompat bool
	for _, v := range versions {
		if v.IsCompatible != nil && !*v.IsCompatible {
			continue
		}
		hasGrafanaCompat = true
		if supportsCurrentArch(v, compatOpts.system) {
			return nil
		}
	}
	if !hasGrafanaCompat {
		return ErrNoCompatibleVersions(pluginID, compatOpts.grafanaVersion)
	}
	return ErrArcNotFound(pluginID, compatOpts.system.OSAndArch())
}

// latestSupportedVersion returns the newest grafana-compatible and arch-compatible
// version in the listing, or Version{} if none exists.
func latestSupportedVersion(versions []Version, compatOpts CompatOpts) Version {
	for _, v := range versions {
		if v.IsCompatible != nil && !*v.IsCompatible {
			continue
		}
		if supportsCurrentArch(v, compatOpts.system) {
			return v
		}
	}
	return Version{}
}

func normalizeVersion(version string) string {
	normalized := strings.ReplaceAll(version, " ", "")
	if strings.HasPrefix(normalized, "^") || strings.HasPrefix(normalized, "v") {
		return normalized[1:]
	}

	return normalized
}
