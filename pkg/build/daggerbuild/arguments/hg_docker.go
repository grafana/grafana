package arguments

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

var HGDirectoryFlags = []cli.Flag{
	&cli.StringFlag{
		Name:     "hosted-grafana-dir",
		Usage:    "Local clone of HG to use, instead of git cloning",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "hosted-grafana-repo",
		Usage:    "https `.git` repository to use for hosted-grafana",
		Required: false,
		Value:    "https://github.com/grafana/hosted-grafana.git",
	},
	&cli.StringFlag{
		Name:     "hosted-grafana-ref",
		Usage:    "git ref to checkout",
		Required: false,
		Value:    "main",
	},
}

// HGDirectory will provide the valueFunc that initializes and returns a *dagger.Directory that has a repository that has the Grafana Pro/Enterprise docker image.
// Where possible, when cloning and no authentication options are provided, the valuefunc will try to use the configured github CLI for cloning.
var HGDirectory = pipeline.Argument{
	Name:        "hg-dir",
	Description: "The source tree of that has the Dockerfile for Grafana Pro/Enterprise",
	Flags:       HGDirectoryFlags,
	ValueFunc:   hgDirectory,
}

type HGDirectoryOpts struct {
	GitHubToken string
	HGDir       string
	HGRepo      string
	HGRef       string
}

func HGDirectoryOptsFromFlags(c cliutil.CLIContext) *HGDirectoryOpts {
	return &HGDirectoryOpts{
		GitHubToken: c.String("github-token"),
		HGDir:       c.String("hosted-grafana-dir"),
		HGRepo:      c.String("hosted-grafana-repo"),
		HGRef:       c.String("hosted-grafana-ref"),
	}
}

func hgDirectory(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
	o := HGDirectoryOptsFromFlags(opts.CLIContext)
	ght, err := githubToken(ctx, o.GitHubToken)
	if err != nil {
		return nil, fmt.Errorf("could not get GitHub token: %w", err)
	}

	src, err := cloneOrMount(ctx, opts.Client, o.HGDir, o.HGRepo, o.HGRef, ght)
	if err != nil {
		return nil, err
	}

	return src, nil
}
