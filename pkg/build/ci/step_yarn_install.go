package main

import (
	"context"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
)

var (
	ArgumentYarnCache  = pipeline.NewDirectoryArgument("yarn-cache")
	EnvYarnCacheFolder = "YARN_CACHE_FOLDER=/opt/drone/yarncache"
)

func yarnInstall(ctx context.Context, opts pipeline.ActionOpts) error {
	sourcePath := opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
	env := []string{
		EnvYarnCacheFolder,
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
