package main

import (
	"context"
	"fmt"

	"dagger.io/dagger"
)

func RunTest(
	ctx context.Context,
	d *dagger.Client,
	grafanaService *dagger.Service,
	pa11yConfig *dagger.File,
	pa11yResultsPath string,
) (*dagger.Container, error) {

	// docker-puppeteer container already has Chrome and Pa11y installed in it
	pa11yContainer := d.Container().From("grafana/docker-puppeteer:1.1.0").
		WithWorkdir("/src").
		WithExec([]string{"mkdir", "-p", "./screenshots"}). // not yet exported
		WithEnvVariable("HOST", grafanaHost).
		WithEnvVariable("PORT", fmt.Sprint(grafanaPort)).
		WithServiceBinding(grafanaHost, grafanaService).
		WithMountedFile("pa11yci-config.js", pa11yConfig).
		WithExec([]string{"pa11y-ci", "--config", "pa11yci-config.js"}, dagger.ContainerWithExecOpts{
			Expect: dagger.ReturnTypeAny, // allow this to fail here so we can handle non-zero exit codes at the caller
		})

	if pa11yResultsPath != "" {
		_, err := pa11yContainer.File("/src/pa11y-ci-results.json").Export(ctx, pa11yResultsPath)
		if err != nil {
			return nil, fmt.Errorf("failed to get pa11y results: %w", err)
		}
	}

	return pa11yContainer, nil
}
