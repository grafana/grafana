package main

import (
	"context"
	"os"
	"path/filepath"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
	cp "github.com/otiai10/copy"
)

// buildDocsWebsite copies the markdown files from 'docs/sources' into the website directory and then uses hugo to build the website.
func buildDocsWebsite(ctx context.Context, opts pipeline.ActionOpts) error {
	var (
		src         = opts.State.MustGetDirectoryString(pipeline.ArgumentSourceFS)
		website     = filepath.Clean("/hugo/content/docs/grafana")
		docs        = filepath.Join(src, "docs/sources")
		destination = filepath.Join(website, "latest")
	)

	if err := os.MkdirAll(website, os.FileMode(0755)); err != nil {
		return err
	}

	if err := cp.Copy(docs, destination); err != nil {
		return err
	}

	return exec.RunCommandWithOpts(ctx, exec.RunOpts{
		Path:   "/hugo",
		Stdout: opts.Stdout,
		Stderr: opts.Stderr,
		Name:   "make",
		Args:   []string{"prod"},
	})
}

// StepBuildDocs builds the documentation website from the docs sources from the grafana repo and the content in the docs website image.
// This step MUST run with the DocsWebsiteImage.
func StepBuildDocsWebsite() pipeline.Step {
	return pipeline.
		NewStep(buildDocsWebsite).
		WithImage(DocsWebsiteImage).
		WithArguments(pipeline.ArgumentSourceFS)
}
