package main

import (
	"context"

	"github.com/grafana/grafana/pkg/build"
	"github.com/grafana/scribe/plumbing/pipeline"
)

var (
	ArgumentGrafanaVersion = pipeline.NewStringArgument("grafana-version")
)

func getVersion(ctx context.Context, opts pipeline.ActionOpts) error {
	repo, err := opts.State.GetDirectory(pipeline.ArgumentSourceFS)
	if err != nil {
		return err
	}

	packageJSON, err := build.OpenPackageJSONFS(repo)
	if err != nil {
		return err
	}

	return opts.State.SetString(ArgumentGrafanaVersion, packageJSON.Version)
}

// GetVersion reads the version in the project's package.json.
func GetVersion() pipeline.Step {
	return pipeline.NewStep(getVersion).
		WithArguments(pipeline.ArgumentSourceFS).
		Provides(ArgumentGrafanaVersion)
}
