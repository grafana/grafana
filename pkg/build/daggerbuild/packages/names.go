package packages

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
)

type Name string

const (
	PackageGrafana          Name = "grafana"
	PackageEnterprise       Name = "grafana-enterprise"
	PackageEnterpriseBoring Name = "grafana-enterprise-boringcrypto"
	PackagePro              Name = "grafana-pro"
	PackageNightly          Name = "grafana-nightly"
)

type NameOpts struct {
	// Name is the name of the product in the package. 99% of the time, this will be "grafana" or "grafana-enterprise".
	Name      Name
	Version   string
	BuildID   string
	Distro    backend.Distribution
	Extension string
}

// FileName returns a file name that matches this format: {grafana|grafana-enterprise}_{version}_{os}_{arch}_{build_number}.tar.gz
func FileName(name Name, version, buildID string, distro backend.Distribution, extension string) (string, error) {
	var (
		// This should return something like "linux", "arm"
		os, arch = backend.OSAndArch(distro)
		// If applicable this will be set to something like "7" (for arm7)
		archv = backend.ArchVersion(distro)
	)

	if archv != "" {
		arch = strings.Join([]string{arch, archv}, "-")
	}

	p := []string{string(name), version, buildID, os, arch}

	return fmt.Sprintf("%s.%s", strings.Join(p, "_"), extension), nil
}
