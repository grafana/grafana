package backend

import (
	"strings"

	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
)

type (
	BuildMode string
	GoARM     string
	GoAMD64   string
	Go386     string
	LibC      int
)

const (
	BuildModeDefault BuildMode = "default"
	BuildModeExe     BuildMode = "exe"
)

const (
	GOARM5 GoARM = "5"
	GOARM6 GoARM = "6"
	GOARM7 GoARM = "7"
)

const (
	Go386SSE2      Go386 = "sse2"
	Go386SoftFloat Go386 = "softfloat"
)

const (
	Musl LibC = iota
	GLibC
)

type GoBuildOpts struct {
	// OS is value supplied to the GOOS environment variable
	OS string

	// Arch is value supplied to the GOARCH environment variable
	Arch string

	// ExperimentalFlags are Go build-time feature flags in the "GOEXPERIMENT" environment variable that enable experimental features.
	ExperimentalFlags []string

	// GOARM: For GOARCH=arm, the ARM architecture for which to compile.
	// Valid values are 5, 6, 7.
	GoARM GoARM

	// GO386: For GOARCH=386, how to implement floating point instructions.
	// Valid values are sse2 (default), softfloat.
	Go386 Go386
}

// GoBuildEnv returns the environment variables that must be set for a 'go build' command given the provided 'GoBuildOpts'.
func GoBuildEnv(opts *GoBuildOpts) []containers.Env {
	var (
		os   = opts.OS
		arch = opts.Arch
	)

	env := []containers.Env{containers.EnvVar("GOOS", os), containers.EnvVar("GOARCH", arch)}

	if arch == "arm" {
		env = append(env, containers.EnvVar("GOARM", string(opts.GoARM)))
	}

	env = append(env, containers.EnvVar("CGO_ENABLED", "0"))

	if opts.ExperimentalFlags != nil {
		env = append(env, containers.EnvVar("GOEXPERIMENT", strings.Join(opts.ExperimentalFlags, ",")))
	}

	return env
}

// ViceroyEnv returns the environment variables that must be set for a 'go build' command given the provided 'GoBuildOpts'.
func ViceroyEnv(opts *GoBuildOpts) []containers.Env {
	var (
		os   = opts.OS
		arch = opts.Arch
	)

	env := []containers.Env{
		containers.EnvVar("VICEROYOS", os),
		containers.EnvVar("GOOS", os),
		containers.EnvVar("VICEROYARCH", arch),
		containers.EnvVar("GOARCH", arch),
	}

	if arch == "arm" {
		env = append(env, containers.EnvVar("VICEROYARM", string(opts.GoARM)))
	}

	env = append(env, containers.EnvVar("CGO_ENABLED", "0"))

	if opts.ExperimentalFlags != nil {
		env = append(env, containers.EnvVar("GOEXPERIMENT", strings.Join(opts.ExperimentalFlags, ",")))
	}

	return env
}
