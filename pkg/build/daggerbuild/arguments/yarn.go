package arguments

import (
	"context"
	"os"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

var YarnCacheDirFlag = &cli.StringFlag{
	Name:    "yarn-cache-dir",
	Aliases: []string{"yarn-cache"},
	Usage:   "Path to the yarn cache directory to mount during 'yarn install' commands (if there is one)",
	EnvVars: []string{"YARN_CACHE_FOLDER", "YARN_CACHE_DIR"},
	Value:   "",
}

var YarnCacheDirectory = pipeline.Argument{
	Name:         "yarn-cache-dir",
	Description:  YarnCacheDirFlag.Usage,
	ArgumentType: pipeline.ArgumentTypeCacheVolume,
	Flags: []cli.Flag{
		YarnCacheDirFlag,
	},
	ValueFunc: func(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
		vol := opts.CLIContext.String(YarnCacheDirFlag.Name)

		// Prepopulate the cache with what's defined in YARN_CACHE_FOLDER
		// or in the CLI
		if val, ok := os.LookupEnv("YARN_CACHE_FOLDER"); ok {
			vol = val
		}

		cache := opts.Client.CacheVolume("yarn-cache-dir")
		if vol == "" {
			return cache, nil
		}

		dir := opts.Client.Host().Directory(vol)
		_, err := opts.Client.Container().
			From("alpine").
			WithMountedCache("/cache", cache).
			WithMountedDirectory("/data", dir).
			WithExec([]string{"/bin/sh", "-c", "cp -r /data/* /cache || return 0"}).
			Sync(ctx)

		if err != nil {
			return nil, err
		}

		return cache, nil
	},
}
