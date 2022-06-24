package main

import (
	"context"
	"os"
	"path/filepath"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
)

var (
	ArgumentYarnCache = pipeline.NewDirectoryArgument("yarn-cache")
)

func yarnInstall(ctx context.Context, opts pipeline.ActionOpts) error {
	sourcePath := opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
	env := []string{
		"YARN_CACHE_FOLDER=/opt/drone/yarncache",
	}

	if err := exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Name:   "yarn",
		Args:   []string{"config", "get", "cacheFolder"},
		Path:   sourcePath,
		Stdout: opts.Stdout,
		Stderr: opts.Stderr,
		Env:    env,
	}); err != nil {
		return err
	}

	if err := exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Name:   "ls",
		Args:   []string{"-al", "/opt/drone/yarncache"},
		Path:   sourcePath,
		Stdout: opts.Stdout,
		Stderr: opts.Stderr,
		Env:    env,
	}); err != nil {
		return err
	}

	return exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Name:   "yarn",
		Args:   []string{"install", "--immutable"},
		Path:   sourcePath,
		Stdout: opts.Stdout,
		Stderr: opts.Stderr,
		Env:    env,
	})
}

func StepYarnInstall() pipeline.Step {
	return pipeline.NewStep(yarnInstall).
		WithArguments(pipeline.ArgumentSourceFS).
		Provides(ArgumentYarnCache).
		WithImage(BuildImage)
}

func yarnSetup(ctx context.Context, opts pipeline.ActionOpts) error {
	var (
		sourcePath = opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
		cachePath  = filepath.Join(sourcePath, ".yarn", "cache")
	)

	if _, err := os.Stat(cachePath); err != nil {
		cache := opts.State.MustGetDirectory(ArgumentYarnCache)
		if err := Extract(cache, cachePath); err != nil {
			return err
		}
	}

	return yarnInstall(ctx, opts)
}

// YarnStep adds the appropriate yarn arguments to the provided step,
// and unpackages the cache directory in the correct location.
func YarnStep(s pipeline.Step) pipeline.Step {
	return pipeline.Combine(pipeline.NewStep(yarnSetup), s).WithArguments(ArgumentYarnCache, pipeline.ArgumentSourceFS).WithImage(s.Image)
}
