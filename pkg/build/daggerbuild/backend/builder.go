package backend

import (
	"fmt"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/golang"
)

// BuildOpts are general options that can change the way Grafana is compiled regardless of distribution.
type BuildOpts struct {
	Version           string
	ExperimentalFlags []string
	Tags              []string
	WireTag           string
	GoCacheProg       string
	Enterprise        bool
}

func distroOptsFunc(log *slog.Logger, distro Distribution, opts *BuildOpts) (DistroBuildOptsFunc, error) {
	return func(distro Distribution, experiments, tags []string) *GoBuildOpts {
		os, arch := OSAndArch(distro)
		archv := ArchVersion(distro)
		return &GoBuildOpts{
			OS:    os,
			Arch:  arch,
			GoARM: GoARM(archv),
		}
	}, nil
}

func WithGoEnv(log *slog.Logger, container *dagger.Container, distro Distribution, opts *BuildOpts) (*dagger.Container, error) {
	fn, err := distroOptsFunc(log, distro, opts)
	if err != nil {
		return nil, err
	}
	bopts := fn(distro, opts.ExperimentalFlags, opts.Tags)

	return containers.WithEnv(container, GoBuildEnv(bopts)), nil
}

func WithViceroyEnv(log *slog.Logger, container *dagger.Container, distro Distribution, opts *BuildOpts) (*dagger.Container, error) {
	fn, err := distroOptsFunc(log, distro, opts)
	if err != nil {
		return nil, err
	}
	bopts := fn(distro, opts.ExperimentalFlags, opts.Tags)

	return containers.WithEnv(container, ViceroyEnv(bopts)), nil
}

func GolangContainer(
	d *dagger.Client,
	log *slog.Logger,
	goVersion string,
	viceroyVersion string,
	platform dagger.Platform,
	distro Distribution,
	opts *BuildOpts,
) (*dagger.Container, error) {
	container := golang.Container(d, platform, goVersion)
	return WithGoEnv(log, container, distro, opts)
}

func withCue(c *dagger.Container, src *dagger.Directory) *dagger.Container {
	return c.
		WithDirectory("/src/cue.mod", src.Directory("cue.mod")).
		WithDirectory("/src/kinds", src.Directory("kinds")).
		WithDirectory("/src/packages/grafana-schema", src.Directory("packages/grafana-schema"), dagger.ContainerWithDirectoryOpts{
			Include: []string{"**/*.cue"},
		}).
		WithDirectory("/src/public/app/plugins", src.Directory("public/app/plugins"), dagger.ContainerWithDirectoryOpts{
			Include: []string{"**/*.cue", "**/plugin.json"},
		}).
		WithFile("/src/embed.go", src.File("embed.go"))
}

// Builder returns the container that is used to build the Grafana backend binaries.
// The build container:
// * Will be based on rfratto/viceroy for Darwin or Windows
// * Will be based on golang:x.y.z-alpine for all other ditsros
// * Will download & cache the downloaded Go modules
// * Will run `make gen-go` on the provided Grafana source
//   - With the linux/amd64 arch/os combination, regardless of what the requested distro is.
//
// * And will have all of the environment variables necessary to run `go build`.
func Builder(
	d *dagger.Client,
	log *slog.Logger,
	distro Distribution,
	opts *BuildOpts,
	platform dagger.Platform,
	goVersion string,
	viceroyVersion string,
) (*dagger.Container, error) {
	// for some distros we use the golang official iamge. For others, we use viceroy.
	return GolangContainer(d, log, goVersion, viceroyVersion, platform, distro, opts)
}

func Wire(d *dagger.Client, src *dagger.Directory, platform dagger.Platform, goVersion string, wireTag string) *dagger.File {
	// withCue is only required during `make gen-go` in 9.5.x or older.
	return withCue(golang.Container(d, platform, goVersion), src).
		WithExec([]string{"apk", "add", "make"}).
		WithDirectory("/src/", src, dagger.ContainerWithDirectoryOpts{
			Include: []string{"**/*.mod", "**/*.sum", "**/*.work", ".git"},
		}).
		WithDirectory("/src/pkg", src.Directory("pkg")).
		WithDirectory("/src/apps", src.Directory("apps")).
		WithDirectory("/src/.citools", src.Directory(".citools")).
		WithFile("/src/Makefile", src.File("Makefile")).
		WithWorkdir("/src").
		WithExec([]string{"make", "gen-go", fmt.Sprintf("WIRE_TAGS=%s", wireTag)}).
		File("/src/pkg/server/wire_gen.go")
}
