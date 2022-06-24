package main

import (
	"context"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
)

func lintDocumentation(ctx context.Context, opts pipeline.ActionOpts) error {
	dir := opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
	return exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Path:   dir,
		Stdout: opts.Stdout,
		Stderr: opts.Stderr,
		Name:   "yarn",
		Args:   []string{"run", "prettier:checkDocs"},
		Env: []string{
			"NODE_OPTIONS=--max_old_space_size=8192",
			EnvYarnCacheFolder,
		},
	})
}

func StepLintDocumentation() pipeline.Step {
	return pipeline.
		NewStep(lintDocumentation).
		WithArguments(pipeline.ArgumentWorkingDir).
		WithImage(BuildImage)
}
