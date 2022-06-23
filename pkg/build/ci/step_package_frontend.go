package main

import (
	"context"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
)

func packageFrontend(ctx context.Context, opts pipeline.ActionOpts) error {
	var (
		src     = opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
		buildID = opts.State.MustGetString(pipeline.ArgumentBuildID)
		grabpl  = opts.State.MustGetFile(ArgumentGrabpl)
	)

	return exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Path:   src,
		Name:   grabpl.Name(),
		Args:   []string{"build-frontend-packages", "--jobs", "8", "--edition", "oss", "--build-id", buildID, "--no-pull-enterprise"},
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
			pipeline.ArgumentSourceFS,
			pipeline.ArgumentBuildID,
			ArgumentGrabpl,
		)
}
