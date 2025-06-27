package arguments

import (
	"context"
	"os"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/golang"
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
		vol := opts.Client.CacheVolume("go-mod-cache")

		// If GOCACHE_S3_BUCKET is set, then don't pre-warm the cache with 'go mod download'
		if _, ok := os.LookupEnv("GOCACHE_S3_BUCKET"); ok {
			return vol, nil
		}

		goVersion, err := opts.State.String(ctx, GoVersion)
		if err != nil {
			return nil, err
		}
		src, err := opts.State.Directory(ctx, GrafanaDirectory)
		if err != nil {
			return nil, err
		}

		c := golang.Container(opts.Client, opts.Platform, goVersion).
			WithEnvVariable("GOMODCACHE", "/go/pkg/mod").
			WithMountedCache("/go/pkg/mod", vol).
			WithDirectory("/src", src, dagger.ContainerWithDirectoryOpts{
				Include: []string{"**/*.mod", "**/*.sum", "**/*.work"},
			}).
			WithWorkdir("/src").
			WithExec([]string{"go", "mod", "download"})

		if _, err := c.Sync(ctx); err != nil {
			return nil, err
		}

		return vol, nil
	},
}
