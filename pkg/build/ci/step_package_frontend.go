package main

import (
	"context"
	"path/filepath"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
)

func packageFrontend(ctx context.Context, opts pipeline.ActionOpts) error {
	var (
		wd      = opts.State.MustGetString(pipeline.ArgumentWorkingDir)
		token   = opts.State.MustGetString(ArgumentGitHubToken)
		buildID = opts.State.MustGetString(pipeline.ArgumentBuildID)
	)

	return exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Path:   wd,
		Name:   filepath.Join("bin", "grabpl"),
		Args:   []string{"build-frontend-packages", "--jobs", "8", "--github-token", token, "--edition", "oss", "--build-id", buildID, "--no-pull-enterprise"},
		Stdout: opts.Stdout,
		Stderr: opts.Stderr,
	})
}

func StepPackageFrontend() pipeline.Step {
	return pipeline.
		NewStep(packageFrontend).
		WithImage(BuildImage).
		WithArguments(
			ArgumentGrabpl,
			ArgumentGitHubToken,
			pipeline.ArgumentWorkingDir,
			pipeline.ArgumentBuildID,
		)
}
