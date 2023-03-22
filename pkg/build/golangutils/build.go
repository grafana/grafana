package golangutils

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
)

type BuildOpts struct {
	// Package refers to the path to the `main` package containing `func main`
	Package string

	// Output is used as the -o argument in the go build command
	Output string

	// Workdir should define some place in the module where the package path resolves.
	// Go commands need to be ran inside a the Go module directory.
	Workdir string

	GoOS   config.OS
	GoArch config.Architecture
	GoArm  string
	Go386  string
	CC     string
	LibC   string

	CGoEnabled bool
	CGoCFlags  string

	// LdFlags are joined by a space character and provided to the -ldflags argument.
	// A valid element here would be `-X 'main.version=1.0.0'`.
	LdFlags []string

	Stdout io.ReadWriter
	Stderr io.ReadWriter
	Stdin  io.ReadWriter

	// ExtraEnv allows consumers to provide extra env args that are not defined above.
	// A single element should be formatted using like so: {NAME}={VALUE}. Example: GOOS=linux.
	ExtraEnv []string

	// ExtraArgs allows consumers to provide extra arguments that are not defined above.
	// Flag names and values should be two separate elements.
	// These flags will be appended to the command arguments before the package path in "go build".
	ExtraArgs []string
}

// Env constructs a list of key/value pairs for setting a build command's environment.
// Should we consider using something to unmarshal the struct to env?
func (opts BuildOpts) Env() []string {
	env := []string{}
	if opts.CGoEnabled {
		env = append(env, "CGO_ENABLED=1")
	}

	if opts.GoOS != "" {
		env = append(env, fmt.Sprintf("GOOS=%s", opts.GoOS))
	}

	if opts.GoArch != "" {
		env = append(env, fmt.Sprintf("GOARCH=%s", opts.GoArch))
	}

	if opts.CC != "" {
		env = append(env, fmt.Sprintf("CC=%s", opts.CC))
	}

	if opts.CGoCFlags != "" {
		env = append(env, fmt.Sprintf("CGO_CFLAGS=%s", opts.CGoCFlags))
	}

	if opts.GoArm != "" {
		env = append(env, fmt.Sprintf("GOARM=%s", opts.GoArm))
	}

	if opts.ExtraEnv != nil {
		return append(opts.ExtraEnv, env...)
	}

	return env
}

// Args constructs a list of flags and values for use with the exec.Command type when running "go build".
func (opts BuildOpts) Args() []string {
	args := []string{}

	if opts.LdFlags != nil {
		args = append(args, "-ldflags", strings.Join(opts.LdFlags, " "))
	}

	if opts.Output != "" {
		args = append(args, "-o", opts.Output)
	}

	if opts.ExtraArgs != nil {
		args = append(args, opts.ExtraArgs...)
	}

	args = append(args, opts.Package)

	return args
}

// Build runs the go build process in the current shell given the opts.
// This function will panic if no Stdout/Stderr/Stdin is provided in the opts.
func RunBuild(ctx context.Context, opts BuildOpts) error {
	env := opts.Env()
	args := append([]string{"build"}, opts.Args()...)
	// Ignore gosec G304 as this function is only used in the build process.
	//nolint:gosec
	cmd := exec.CommandContext(ctx, "go", args...)
	cmd.Env = env

	cmd.Stdout = opts.Stdout
	cmd.Stderr = opts.Stderr
	cmd.Stdin = opts.Stdin
	cmd.Dir = opts.Workdir

	return cmd.Run()
}
