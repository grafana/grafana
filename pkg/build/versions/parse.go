package versions

import (
	"regexp"
	"strings"
)

var semverRegex = regexp.MustCompile(`^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)

type Semver struct {
	Major         string
	Minor         string
	Patch         string
	Prerelease    string
	BuildMetadata string
}

func ParseSemver(version string) Semver {
	version = strings.TrimPrefix(version, "v")
	matches := semverRegex.FindStringSubmatch(version)
	results := make(map[string]string)
	for i, name := range semverRegex.SubexpNames() {
		if i != 0 && name != "" {
			results[name] = matches[i]
		}
	}

	return Semver{
		Major:         results["major"],
		Minor:         results["minor"],
		Patch:         results["patch"],
		Prerelease:    results["prerelease"],
		BuildMetadata: results["buildmetadata"],
	}
}
