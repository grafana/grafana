package main

import (
	"context"
	"fmt"
	"strings"

	"dagger.io/dagger"
)

var (
	// Locations in the container to write results to
	testResultsDir = "/playwright-test-results"
	htmlResultsDir = "/playwright-html-report"
	blobResultsDir = "/playwright-blob-report"
)

type RunTestOpts struct {
	GrafanaService       *dagger.Service
	FrontendContainer    *dagger.Container
	HostSrc              *dagger.Directory
	Shard                string
	HTMLReportExportDir  string
	BlobReportExportDir  string
	TestResultsExportDir string
	PlaywrightCommand    string
}

func RunTest(
	ctx context.Context,
	d *dagger.Client,
	opts RunTestOpts,
) (*dagger.Container, error) {
	playwrightCommand := buildPlaywrightCommand(opts)

	grafanaHost, err := opts.GrafanaService.Hostname(ctx)
	if err != nil {
		return nil, err
	}

	e2eContainer := opts.FrontendContainer.
		WithWorkdir("/src").
		WithDirectory("/src", opts.HostSrc).
		WithMountedCache(".nx", d.CacheVolume("nx-cache")).
		WithEnvVariable("CI", "true").
		WithEnvVariable("GRAFANA_URL", fmt.Sprintf("http://%s:%d", grafanaHost, grafanaPort)).
		WithServiceBinding(grafanaHost, opts.GrafanaService).
		WithEnvVariable("bustcache", "1").
		WithEnvVariable("PLAYWRIGHT_HTML_OPEN", "never").
		WithEnvVariable("PLAYWRIGHT_HTML_OUTPUT_DIR", htmlResultsDir).
		WithEnvVariable("PLAYWRIGHT_BLOB_OUTPUT_DIR", blobResultsDir).
		WithExec(playwrightCommand, dagger.ContainerWithExecOpts{
			Expect: dagger.ReturnTypeAny,
		})

	if opts.TestResultsExportDir != "" {
		_, err := e2eContainer.Directory(testResultsDir).Export(ctx, opts.TestResultsExportDir)
		if err != nil {
			return nil, err
		}
	}

	if opts.HTMLReportExportDir != "" {
		_, err := e2eContainer.Directory(htmlResultsDir).Export(ctx, opts.HTMLReportExportDir)
		if err != nil {
			return nil, err
		}
	}

	if opts.BlobReportExportDir != "" {
		_, err := e2eContainer.Directory(blobResultsDir).Export(ctx, opts.BlobReportExportDir)
		if err != nil {
			return nil, err
		}
	}

	return e2eContainer, nil
}

func buildPlaywrightCommand(opts RunTestOpts) []string {
	playwrightReporters := []string{
		"dot", // minimal output in shards
	}

	if opts.HTMLReportExportDir != "" {
		playwrightReporters = append(playwrightReporters, "html")
	}

	if opts.BlobReportExportDir != "" {
		playwrightReporters = append(playwrightReporters, "blob")
	}

	playwrightExec := strings.Split(opts.PlaywrightCommand, " ")

	playwrightCommand := append(playwrightExec,
		"--reporter",
		strings.Join(playwrightReporters, ","),
		"--output",
		testResultsDir,
	)

	if opts.Shard != "" {
		playwrightCommand = append(playwrightCommand, "--shard", opts.Shard)
	}

	return playwrightCommand
}
