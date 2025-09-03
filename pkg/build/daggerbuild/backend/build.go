package backend

import (
	"fmt"
	"log"
	"path"
	"strings"

	"dagger.io/dagger"
)

type LDFlag struct {
	Name   string
	Values []string
}

func GoLDFlags(flags []LDFlag) string {
	ldflags := strings.Builder{}
	for _, v := range flags {
		if v.Values == nil {
			ldflags.WriteString(v.Name + " ")
			continue
		}

		for _, value := range v.Values {
			// For example, "-X 'main.version=v1.0.0'"
			ldflags.WriteString(fmt.Sprintf(`%s \"%s\" `, v.Name, value))
		}
	}

	return ldflags.String()
}

// GoBuildCommand returns the arguments for go build to be used in 'WithExec'.
func GoBuildCommand(output string, ldflags []LDFlag, tags []string, main string) []string {
	args := []string{"go", "build",
		// We should not publish Grafana as a Go module, disabling vcs changes the version to (devel)
		// and works better with SBOM and Vulnerability Scanners.
		"-buildvcs=false",
		fmt.Sprintf("-ldflags=\"%s\"", GoLDFlags(ldflags)),
		fmt.Sprintf("-o=%s", output),
		"-trimpath",
		fmt.Sprintf("-tags=%s", strings.Join(tags, ",")),
		// Go is weird and paths referring to packages within a module to be prefixed with "./".
		// Otherwise, the path is assumed to be relative to $GOROOT
		"./" + main,
	}

	return args
}

func Build(
	d *dagger.Client,
	builder *dagger.Container,
	src *dagger.Directory,
	distro Distribution,
	out string,
	opts *BuildOpts,
) *dagger.Directory {
	vcsinfo := GetVCSInfo(src, opts.Version, opts.Enterprise)
	builder = WithVCSInfo(builder, vcsinfo, opts.Enterprise)

	ldflags := LDFlagsDynamic(vcsinfo)

	if opts.Static {
		ldflags = LDFlagsStatic(vcsinfo)
	}

	cmd := []string{
		"grafana",
		"grafana-server",
		"grafana-cli",
		"grafana-example-apiserver",
	}

	os, _ := OSAndArch(distro)

	for _, v := range cmd {
		// Some CLI packages such as grafana-example-apiserver don't exist in earlier Grafana Versions <10.3
		// Below check skips building them as needed
		pkgPath := path.Join("pkg", "cmd", v)
		out := path.Join(out, v)
		if os == "windows" {
			out += ".exe"
		}

		cmd := GoBuildCommand(out, ldflags, opts.Tags, pkgPath)

		script := fmt.Sprintf(`if [ -d %s ]; then %s; fi`, pkgPath, strings.Join(cmd, " "))
		log.Printf("Building with command '%s'", script)

		builder = builder.
			WithExec([]string{"/bin/sh", "-c", script})
	}

	return builder.Directory(out)
}
