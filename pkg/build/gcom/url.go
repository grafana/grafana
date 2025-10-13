package gcom

import (
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/build/versions"
)

func PackageName(grafana, distro, arch, version, ext string, musl bool, raspberryPi bool) string {
	v := versions.ParseSemver(version)

	if raspberryPi {
		grafana += "-rpi"
	}

	versionString := strings.Join([]string{v.Major, v.Minor, v.Patch}, ".")
	fmt.Println("Version string:", versionString)
	if distro == "deb" {
		if v.BuildMetadata != "" {
			versionString += "+" + strings.ReplaceAll(v.BuildMetadata, "-", "~")
		}

		if v.Prerelease != "" {
			versionString += "~" + v.Prerelease
		}

		return strings.Join([]string{grafana, versionString, arch}, "_") + "." + ext
	}

	if distro == "rhel" {
		if v.BuildMetadata != "" {
			versionString += "+" + strings.ReplaceAll(v.BuildMetadata, "-", "~")
		}

		if v.Prerelease != "" {
			versionString += "~" + v.Prerelease
		}

		versionString += "-1"

		// Notable difference between our deb naming and our RPM naming: the file ends with `.arch.ext`, not
		// `_arch.ext`.
		return strings.Join([]string{grafana, versionString}, "-") + "." + arch + "." + ext
	}

	if v.Prerelease != "" {
		versionString += "-" + v.Prerelease
	}

	if v.BuildMetadata != "" {
		versionString += "+" + v.BuildMetadata
	}

	if musl {
		arch += "-musl"
	}

	// grafana-enterprise-1.2.3+example-01.linux-amd64.tar.gz
	return fmt.Sprintf("%s-%s.%s-%s.%s", grafana, versionString, distro, arch, ext)
}

func GetURL(baseURL *url.URL, version, grafana, distro, arch, ext string, musl, raspberryPi bool) *url.URL {
	packageName := PackageName(grafana, distro, arch, version, ext, musl, raspberryPi)
	return &url.URL{
		Host:   baseURL.Host,
		Scheme: baseURL.Scheme,
		Path:   path.Join(baseURL.Path, packageName),
	}
}
