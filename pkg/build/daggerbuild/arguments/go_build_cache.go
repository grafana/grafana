package arguments

import (
	"context"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

var GoBuildCache = pipeline.Argument{
	Name:         "go-cache-volume",
	Description:  "Mounted at GOCACHE when building Go backends",
	ArgumentType: pipeline.ArgumentTypeCacheVolume,
	Flags:        []cli.Flag{},
	ValueFunc: func(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
		return opts.Client.CacheVolume("go-build-cache"), nil
	},
}

var GoModCache = pipeline.Argument{
	Name:         "go-mod-volume",
	Description:  "Stores downloaded Go modules when building Go backends",
	ArgumentType: pipeline.ArgumentTypeCacheVolume,
	Flags:        []cli.Flag{},
	ValueFunc: func(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
		return opts.Client.CacheVolume("go-mod-cache"), nil
	},
}
