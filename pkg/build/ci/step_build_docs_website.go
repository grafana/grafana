package main

import (
	"context"

	"github.com/grafana/scribe/plumbing/pipeline"
)

func buildDocsWebsite(ctx context.Context, opts pipeline.ActionOpts) error {
	return nil
}

func StepBuildDocsWebsite() pipeline.Step {
	return pipeline.NewStep(buildDocsWebsite)
}
