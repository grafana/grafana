package fpm

import (
	"fmt"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/versions"
)

type PackageType string

const (
	PackageTypeDeb PackageType = "deb"
	PackageTypeRPM PackageType = "rpm"
)

type BuildOpts struct {
	Name         packages.Name
	Enterprise   bool
	Version      string
	BuildID      string
	Distribution backend.Distribution
	NameOverride string
	PackageType  PackageType
	ConfigFiles  [][]string
	AfterInstall string
	BeforeRemove string
	Depends      []string
	EnvFolder    string
	ExtraArgs    []string
	RPMSign      bool
}

func Build(builder *dagger.Container, opts BuildOpts, targz *dagger.File) *dagger.File {
	var (
		destination = fmt.Sprintf("/src/package.%s", opts.PackageType)
		fpmArgs     = []string{
			"fpm",
			"--input-type=dir",
			"--chdir=/pkg",
			fmt.Sprintf("--output-type=%s", opts.PackageType),
			"--vendor=\"Grafana Labs\"",
			"--url=https://grafana.com",
			"--maintainer=contact@grafana.com",
			fmt.Sprintf("--version=%s", strings.TrimPrefix(opts.Version, "v")),
			fmt.Sprintf("--package=%s", destination),
		}

		vopts = versions.OptionsFor(opts.Version)
	)

	// If this is a debian installer and this version had a prerm script (introduced in v9.5)...
	// TODO: this logic means that rpms can't also have a beforeremove. Not important at the moment because it's static (in pipelines/rpm.go) and it doesn't have beforeremove set.
	if vopts.DebPreRM.IsSet && vopts.DebPreRM.Value && opts.PackageType == "deb" {
		if opts.BeforeRemove != "" {
			fpmArgs = append(fpmArgs, fmt.Sprintf("--before-remove=%s", opts.BeforeRemove))
		}
	}

	// These paths need to be absolute when installed on the machine and not the package structure.
	for _, c := range opts.ConfigFiles {
		fpmArgs = append(fpmArgs, fmt.Sprintf("--config-files=%s", strings.TrimPrefix(c[1], "/pkg")))
	}

	if opts.AfterInstall != "" {
		fpmArgs = append(fpmArgs, fmt.Sprintf("--after-install=%s", opts.AfterInstall))
	}

	for _, d := range opts.Depends {
		fpmArgs = append(fpmArgs, fmt.Sprintf("--depends=%s", d))
	}

	fpmArgs = append(fpmArgs, opts.ExtraArgs...)

	if arch := backend.PackageArch(opts.Distribution); arch != "" {
		fpmArgs = append(fpmArgs, fmt.Sprintf("--architecture=%s", arch))
	}

	packageName := string(opts.Name)
	// Honestly we don't care about making fpm installers for non-enterprise or non-grafana flavors of grafana
	if opts.Enterprise {
		fpmArgs = append(fpmArgs, "--description=\"Grafana Enterprise\"")
		fpmArgs = append(fpmArgs, "--conflicts=grafana")
	} else {
		fpmArgs = append(fpmArgs, "--description=Grafana")
		fpmArgs = append(fpmArgs, "--license=AGPLv3")
	}

	if n := opts.NameOverride; n != "" {
		packageName = n
	}

	fpmArgs = append(fpmArgs, fmt.Sprintf("--name=%s", packageName))

	// The last fpm arg which is required to say, "use the PWD to build the package".
	fpmArgs = append(fpmArgs, ".")

	var (
		// fpm is going to create us a package that is going to essentially rsync the folders from the package into the filesystem.
		// These paths are the paths where grafana package contents will be placed.
		packagePaths = []string{
			"/pkg/usr/sbin",
			"/pkg/usr/share",
			// holds default environment variables for the grafana-server service
			opts.EnvFolder,
			// /etc/grafana is empty in the installation, but is set up by the postinstall script and must be created first.
			"/pkg/etc/grafana",
			// these are our systemd unit files that allow systemd to start/stop/restart/enable the grafana service.
			"/pkg/usr/lib/systemd/system",
		}
	)

	// init.d scripts are service management scripts that start/stop/restart/enable the grafana service without systemd.
	// these are likely to be deprecated as systemd is now the default pretty much everywhere.
	if opts.PackageType != PackageTypeRPM {
		packagePaths = append(packagePaths, "/pkg/etc/init.d")
	}

	container := builder.
		WithFile("/src/grafana.tar.gz", targz).
		WithEnvVariable("XZ_DEFAULTS", "-T0").
		WithExec([]string{"tar", "--exclude=storybook", "--strip-components=1", "-xf", "/src/grafana.tar.gz", "-C", "/src"}).
		WithExec([]string{"rm", "/src/grafana.tar.gz"})

	container = container.
		WithExec(append([]string{"mkdir", "-p"}, packagePaths...)).
		// the "wrappers" scripts are the same as grafana-cli/grafana-server but with some extra shell commands before/after execution.
		WithExec([]string{"cp", "/src/packaging/wrappers/grafana-server", "/src/packaging/wrappers/grafana-cli", "/pkg/usr/sbin"}).
		WithExec([]string{"cp", "-r", "/src", "/pkg/usr/share/grafana"})

	for _, conf := range opts.ConfigFiles {
		container = container.WithExec(append([]string{"cp", "-r"}, conf...))
	}

	return container.WithExec(fpmArgs).File(destination)
}
