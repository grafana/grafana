package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"

	"github.com/grafana/scribe/exec"
	"github.com/grafana/scribe/plumbing/pipeline"
	"github.com/grafana/scribe/swfs"
)

var wordsToIgnore = `
unknown
referer
errorstring
eror
iam
wan
`

func codespell(ctx context.Context, opts pipeline.ActionOpts) error {
	buf := bytes.NewBufferString(wordsToIgnore)
	path := filepath.Join(os.TempDir(), "words_to_ignore.txt")
	if err := swfs.CopyFileReader(buf, path); err != nil {
		return err
	}

	return exec.RunCommandWithOpts(
		ctx,
		exec.RunOpts{
			Stdout: opts.Stdout,
			Stderr: opts.Stderr,
			Name:   "codespell",
			Args:   []string{"-I", path, "docs/"},
		},
	)
}

func StepCodespell() pipeline.Step {
	return pipeline.NewStep(codespell).WithImage(BuildImage)
}
