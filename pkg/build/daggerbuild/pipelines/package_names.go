package pipelines

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
)

type TarFileOpts struct {
	// Name is the name of the product in the package. 99% of the time, this will be "grafana" or "grafana-enterprise".
	Name    string
	Version string
	BuildID string
	// Edition is the flavor text after "grafana-", like "enterprise".
	Edition string
	Distro  backend.Distribution
	Suffix  string
}

func (opts *TarFileOpts) NameOpts() packages.NameOpts {
	return packages.NameOpts{
		// Name is the name of the product in the package. 99% of the time, this will be "grafana" or "grafana-enterprise".
		Name:    packages.Name(opts.Name),
		Version: opts.Version,
		BuildID: opts.BuildID,
		Distro:  opts.Distro,
	}
}

func WithoutExt(name string) string {
	ext := filepath.Ext(name)
	n := strings.TrimSuffix(name, ext)

	// Explicitly handle `.gz` which might will also probably have a `.tar` extension as well.
	if ext == ".gz" {
		n = strings.TrimSuffix(n, ".ubuntu.docker.tar")
		n = strings.TrimSuffix(n, ".docker.tar")
		n = strings.TrimSuffix(n, ".tar")
	}

	return n
}

func TarOptsFromFileName(filename string) TarFileOpts {
	filename = filepath.Base(filename)
	n := WithoutExt(filename)
	components := strings.Split(n, "_")
	if len(components) != 5 {
		return TarFileOpts{}
	}

	var (
		name    = components[0]
		version = components[1]
		buildID = components[2]
		os      = components[3]
		arch    = components[4]
	)
	if archv := strings.Split(arch, "-"); len(archv) == 2 {
		// The reverse operation of removing the 'v' for 'arm' because the golang environment variable
		// GOARM doesn't want it, but the docker --platform flag either doesn't care or does want it.
		if archv[0] == "arm" {
			archv[1] = "v" + archv[1]
		}

		// arm-7 should become arm/v7
		arch = strings.Join([]string{archv[0], archv[1]}, "/")
	}
	edition := ""
	suffix := ""
	if n := strings.Split(name, "-"); len(n) != 1 {
		edition = strings.Join(n[1:], "-")
		suffix = fmt.Sprintf("-%s", n[1])
	}

	return TarFileOpts{
		Name:    name,
		Edition: edition,
		Version: version,
		BuildID: buildID,
		Distro:  backend.Distribution(strings.Join([]string{os, arch}, "/")),
		Suffix:  suffix,
	}
}
