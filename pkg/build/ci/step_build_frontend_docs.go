package main

import (
	"context"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
)

func buildFrontendDocs(ctx context.Context, opts pipeline.ActionOpts) error {
	var (
		src = opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
	)

	// No clue what this script actually does.
	// I think it makes every package build a bunch of documentation and then it copies it to ./reports/docs?
	// I'd like to actually define the inputs and outputs here.
	return exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Path: src,
		Name: "./scripts/ci-reference-docs-lint.sh",
		Args: []string{"ci"},
	})
}

func StepBuildFrontendDocs() pipeline.Step {
	return pipeline.NewStep(buildFrontendDocs).
		WithImage(BuildImage).
		WithArguments(pipeline.ArgumentSourceFS)
}
