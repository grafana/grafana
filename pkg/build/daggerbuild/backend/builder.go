package backend

import (
	"errors"
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
	Static            bool
	Enterprise        bool
	CGOEnabled        bool
}

func distroOptsFunc(log *slog.Logger, distro Distribution, opts *BuildOpts) (DistroBuildOptsFunc, error) {
	if !opts.CGOEnabled {
		return func(distro Distribution, experiments, tags []string) *GoBuildOpts {
			os, arch := OSAndArch(distro)
			archv := ArchVersion(distro)
			return &GoBuildOpts{
				OS:         os,
				Arch:       arch,
				GoARM:      GoARM(archv),
				CGOEnabled: false,
			}
		}, nil
	}

	if val, ok := DistributionGoOpts[distro]; ok {
		return DistroOptsLogger(log, val), nil
	}
	return nil, errors.New("unrecognized distribution")
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

func ViceroyContainer(
	d *dagger.Client,
	log *slog.Logger,
	distro Distribution,
	goVersion string,
	viceroyVersion string,
	opts *BuildOpts,
) (*dagger.Container, error) {
	containerOpts := dagger.ContainerOpts{
		Platform: "linux/amd64",
	}

	// Instead of directly using the `arch` variable here to substitute in the GoURL, we have to be careful with the Go releases.
	// Supported releases (in the names):
	// * amd64
	// * armv6l
	// * arm64
	goURL := golang.DownloadURL(goVersion, "amd64")
	container := d.Container(containerOpts).From(fmt.Sprintf("rfratto/viceroy:%s", viceroyVersion))

	// Install Go manually, and install make, git, and curl from the package manager.
	container = container.
		WithExec([]string{"dpkg", "--remove-architecture", "ppc64el"}).
		WithExec([]string{"dpkg", "--remove-architecture", "s390x"}).
		WithExec([]string{"dpkg", "--remove-architecture", "armel"}).
		WithExec([]string{"apt-get", "update", "-yq"}).
		WithExec([]string{"apt-get", "install", "-yq", "curl", "make", "git"}).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("curl -L %s | tar -C /usr/local -xzf -", goURL)}).
		WithEnvVariable("PATH", "/bin:/usr/bin:/usr/local/bin:/usr/local/go/bin:/usr/osxcross/bin")

	return WithViceroyEnv(log, container, distro, opts)
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
	os, _ := OSAndArch(distro)
	// Only use viceroy for all darwin builds
	if opts.CGOEnabled && os == "darwin" {
		return ViceroyContainer(d, log, distro, goVersion, viceroyVersion, opts)
	}

	// The Kerberos/GSSAPI variant needs real glibc dev headers (<gssapi/gssapi.h>) and is a
	// native linux/amd64 build (the runner is already amd64), so it skips the Alpine+zig
	// cross-compile path entirely rather than trying to get glibc krb5 headers into zig's sysroot.
	if opts.CGOEnabled && distro == DistLinuxAMD64Krb5 {
		return Krb5Container(d, log, goVersion, distro, opts)
	}

	container := golang.Container(d, platform, goVersion)
	if opts.CGOEnabled {
		container = container.
			WithExec([]string{"apk", "add", "--update", "wget", "build-base", "alpine-sdk", "musl", "musl-dev", "xz"}).
			WithExec([]string{"wget", "-q", "https://dl.grafana.com/ci/zig-linux-x86_64-0.11.0.tar.xz"}).
			WithExec([]string{"tar", "--strip-components=1", "-C", "/", "-xf", "zig-linux-x86_64-0.11.0.tar.xz"}).
			WithExec([]string{"mv", "/zig", "/bin/zig"}).
			// Install the toolchain specifically for armv7 until we figure out why it's crashing w/ zig container = container.
			WithExec([]string{"mkdir", "/toolchain"}).
			WithExec([]string{"wget", "-q", "http://dl.grafana.com/ci/arm-linux-musleabihf-cross.tgz", "-P", "/toolchain"}).
			WithExec([]string{"tar", "-xf", "/toolchain/arm-linux-musleabihf-cross.tgz", "-C", "/toolchain"}).
			WithExec([]string{"wget", "-q", "https://dl.grafana.com/ci/s390x-linux-musl-cross.tgz", "-P", "/toolchain"}).
			WithExec([]string{"tar", "-xf", "/toolchain/s390x-linux-musl-cross.tgz", "-C", "/toolchain"}).
			WithExec([]string{"wget", "-q", "https://dl.grafana.com/ci/riscv64-linux-musl-cross.tgz", "-P", "/toolchain"}).
			WithExec([]string{"tar", "-xf", "/toolchain/riscv64-linux-musl-cross.tgz", "-C", "/toolchain"}).
			WithExec([]string{"wget", "-q", "https://dl.grafana.com/ci/x86_64-w64-mingw32-cross.tgz", "-P", "/toolchain"}).
			WithExec([]string{"tar", "-xf", "/toolchain/x86_64-w64-mingw32-cross.tgz", "-C", "/toolchain"})
	}
	return WithGoEnv(log, container, distro, opts)
}

// Krb5Container returns a Debian ("bookworm") based Go build container with the Kerberos/GSSAPI
// development headers installed, used only for DistLinuxAMD64Krb5. The grafana-enterprise-kerberos
// variant links a forked go-sql-driver/mysql that adds GSSAPI (Kerberos) auth support for MySQL;
// the CGO dependency (github.com/openshift/gssapi) only needs <gssapi/gssapi.h> at compile time and
// dlopen()s libgssapi_krb5.so at runtime, so no cross-compiled library is needed - just the header,
// from a real glibc/Debian environment rather than Alpine.
//
// Unlike every other CGO distro, this one skips zig and relies on the container's own native gcc,
// so it deliberately ignores the caller's requested platform (which, unlike the Distribution itself,
// is derived from a global --platform flag that defaults to the invoking host's own arch - e.g.
// linux/arm64 on an Apple Silicon machine running `dagger run` locally) and always builds on
// linux/amd64, which this distro targets unconditionally.
func Krb5Container(
	d *dagger.Client,
	log *slog.Logger,
	goVersion string,
	distro Distribution,
	opts *BuildOpts,
) (*dagger.Container, error) {
	container := d.Container(dagger.ContainerOpts{Platform: "linux/amd64"}).
		From(fmt.Sprintf("golang:%s-bookworm", goVersion)).
		WithExec([]string{"apt-get", "update"}).
		WithExec([]string{"apt-get", "install", "-y",
			"gcc", "libgssapi-krb5-2", "libkrb5-dev", "libsasl2-modules-gssapi-mit"})

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
	src *dagger.Directory,
	goVersion string,
	viceroyVersion string,
	goBuildCache *dagger.CacheVolume,
	goModCache *dagger.CacheVolume,
) (*dagger.Container, error) {
	var (
		version = opts.Version
	)

	// for some distros we use the golang official iamge. For others, we use viceroy.
	builder, err := GolangContainer(d, log, goVersion, viceroyVersion, platform, distro, opts)
	if err != nil {
		return nil, err
	}

	builder = builder.
		WithMountedCache("/root/.cache/go", goBuildCache).
		WithEnvVariable("GOCACHE", "/root/.cache/go")

	if prog := opts.GoCacheProg; prog != "" {
		builder = builder.WithEnvVariable("GOCACHEPROG", prog)
	}

	commitInfo := GetVCSInfo(src, version, opts.Enterprise)

	builder = withCue(builder, src).
		WithDirectory("/src/", src, dagger.ContainerWithDirectoryOpts{
			Include: []string{"**/*.mod", "**/*.sum", "**/*.work", ".git"},
		}).
		WithDirectory("/src/pkg", src.WithoutDirectory("pkg/build").Directory("pkg")).
		WithDirectory("/src/apps", src.Directory("apps")).
		WithDirectory("/src/emails", src.Directory("emails")).
		WithFile("/src/pkg/server/wire_gen.go", Wire(d, src, platform, goVersion, opts.WireTag)).
		WithFile("/src/.buildinfo.commit", commitInfo.Commit).
		WithWorkdir("/src")

	if opts.Enterprise {
		builder = builder.WithFile("/src/.buildinfo.enterprise-commit", commitInfo.EnterpriseCommit)
	}

	// Swap in the Kerberos-patched go-sql-driver/mysql fork, only inside this ephemeral build
	// container's copy of go.mod/go.sum - this never touches the committed checkout. The fork
	// (github.com/grafana/mysql@v1.7.1g) is upstream go-sql-driver/mysql v1.7.1 (the version
	// already pinned repo-wide for unrelated reasons) plus GSSAPI/Kerberos support.
	if distro == DistLinuxAMD64Krb5 {
		builder = builder.
			WithExec([]string{"go", "mod", "edit",
				"-replace", "github.com/go-sql-driver/mysql=github.com/grafana/mysql@v1.7.1g"}).
			WithExec([]string{"go", "get",
				"github.com/jcmturner/gokrb5/v8@v8.4.4",
				"github.com/openshift/gssapi@v0.0.0-20161010215902-5fb4217df13b"}).
			WithExec([]string{"go", "mod", "tidy"})
	}

	builder = golang.WithCachedGoDependencies(
		builder,
		goModCache,
	)

	return builder, nil
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
		WithDirectory("/src/.bingo", src.Directory(".bingo")).
		WithDirectory("/src/.citools", src.Directory(".citools")).
		WithFile("/src/Makefile", src.File("Makefile")).
		WithWorkdir("/src").
		WithExec([]string{"make", "gen-go", fmt.Sprintf("WIRE_TAGS=%s", wireTag)}).
		File("/src/pkg/server/wire_gen.go")
}
