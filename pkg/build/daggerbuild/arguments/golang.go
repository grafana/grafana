package arguments

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

const (
	DefaultViceroyVersion = "v0.4.0"
)

var GoVersion = pipeline.Argument{
	Name:         "go-version",
	Description:  "The Go version to use when compiling Grafana",
	ArgumentType: pipeline.ArgumentTypeString,
	ValueFunc: func(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
		src, err := opts.State.Directory(ctx, GrafanaDirectory)
		if err != nil {
			return nil, err
		}

		stdout, err := opts.Client.Container().From("alpine").
			WithMountedFile("/src/go.mod", src.File("go.mod")).
			WithWorkdir("/src").
			WithExec([]string{"/bin/sh", "-c", `grep '^go ' go.mod | awk '{print $2}'`}).
			Stdout(ctx)

		return strings.TrimSpace(stdout), err
	},
}

var ViceroyVersionFlag = &cli.StringFlag{
	Name:  "viceroy-version",
	Usage: "This flag sets the base image of the container used to build the Grafana backend binaries for non-Linux distributions",
	Value: DefaultViceroyVersion,
}

var ViceroyVersion = pipeline.NewStringFlagArgument(ViceroyVersionFlag)
