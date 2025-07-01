package main

import (
	"context"
	"encoding/json"
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

type Deps struct {
	NodeVersion       string
	PlaywrightVersion string
}

func GetVersions(ctx context.Context, src *dagger.Directory) (Deps, error) {
	nvmrc, err := src.File(".nvmrc").Contents(ctx)
	if err != nil {
		return Deps{}, err
	}
	pkgJSON, err := src.File("package.json").Contents(ctx)
	if err != nil {
		return Deps{}, err
	}

	// parse package.json
	var pkgJson struct {
		DevDependencies map[string]string `json:"devDependencies"`
	}
	if err := json.Unmarshal([]byte(pkgJSON), &pkgJson); err != nil {
		return Deps{}, err
	}

	return Deps{
		NodeVersion:       strings.TrimSpace(strings.TrimPrefix(nvmrc, "v")),
		PlaywrightVersion: strings.TrimSpace(pkgJson.DevDependencies["@playwright/test"]),
	}, nil
}

type RunTestOpts struct {
	Shard                string
	GrafanaService       *dagger.Service
	HTMLReportExportDir  string
	BlobReportExportDir  string
	TestResultsExportDir string
}

func RunTest(
	ctx context.Context,
	d *dagger.Client,
	opts RunTestOpts,
) (*dagger.Container, error) {

	grafanaDir := "." // TODO: arg

	nxCache := d.CacheVolume("nx-cache")

	// Minimal files needed to run yarn install
	yarnHostSrc := d.Host().Directory(grafanaDir, dagger.HostDirectoryOpts{
		Include: []string{
			"package.json",
			"yarn.lock",
			".yarnrc.yml",
			".yarn",
			"packages/*/package.json",
			"public/app/plugins/*/*/package.json",
			"e2e/test-plugins/*/package.json",
			".nvmrc",
		},
	})

	// Files needed to run e2e tests. Above files will be copied into the test runner container as well.
	e2eHostSrc := d.Host().Directory(".", dagger.HostDirectoryOpts{
		Include: []string{
			"public/app/types/*.d.ts",
			"public/app/core/icons/cached.json",

			// packages we use in playwright tests
			"packages", // TODO: do we need all of this?
			"e2e/test-plugins",
			"public/app/plugins", // TODO: do we need all of this?

			// e2e files
			"e2e-playwright",
			"playwright.config.ts",
		},
		Exclude: []string{
			"**/dist",
		},
	})

	deps, err := GetVersions(ctx, yarnHostSrc)
	if err != nil {
		return nil, err
	}

	nodeBase := WithNode(d, deps.NodeVersion)
	playwrightBase := WithPlaywright(d, nodeBase, deps.PlaywrightVersion)

	playwrightCommand := buildPlaywrightCommand(opts)

	e2eContainer := WithYarnInstall(d, playwrightBase, yarnHostSrc).
		WithWorkdir("/src").
		WithDirectory("/src", e2eHostSrc).
		WithMountedCache(".nx", nxCache).
		WithExec([]string{"yarn", "e2e:plugin:build"}).
		WithEnvVariable("HOST", grafanaHost).
		WithEnvVariable("PORT", fmt.Sprint(grafanaPort)).
		WithServiceBinding(grafanaHost, opts.GrafanaService).
		WithEnvVariable("bustcache", "1").
		WithEnvVariable("PLAYWRIGHT_HTML_OPEN", "never").
		WithEnvVariable("PLAYWRIGHT_HTML_OUTPUT_DIR", htmlResultsDir).
		WithEnvVariable("PLAYWRIGHT_BLOB_OUTPUT_DIR", blobResultsDir).
		WithExec(playwrightCommand, dagger.ContainerWithExecOpts{
			Expect: dagger.ReturnTypeAny,
		})

	if opts.TestResultsExportDir != "" {
		_, err = e2eContainer.Directory(testResultsDir).Export(ctx, opts.TestResultsExportDir)
		if err != nil {
			return nil, err
		}
	}

	if opts.HTMLReportExportDir != "" {
		_, err = e2eContainer.Directory(htmlResultsDir).Export(ctx, opts.HTMLReportExportDir)
		if err != nil {
			return nil, err
		}
	}

	if opts.BlobReportExportDir != "" {
		_, err = e2eContainer.Directory(blobResultsDir).Export(ctx, opts.BlobReportExportDir)
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

	playwrightCommand := []string{
		"yarn",
		"e2e:playwright",
		"--reporter",
		strings.Join(playwrightReporters, ","),
		"--output",
		testResultsDir,
	}

	if opts.Shard != "" {
		playwrightCommand = append(playwrightCommand, "--shard", opts.Shard)
	}

	return playwrightCommand
}

func WithNode(d *dagger.Client, version string) *dagger.Container {
	nodeImage := fmt.Sprintf("node:%s-slim", strings.TrimPrefix(version, "v"))
	return d.Container().From(nodeImage)
}

func WithPlaywright(d *dagger.Client, base *dagger.Container, version string) *dagger.Container {
	brCache := d.CacheVolume("playwright-browsers")
	return base.
		WithEnvVariable("PLAYWRIGHT_BROWSERS_PATH", "/playwright-cache").
		WithMountedCache("/playwright-cache", brCache).
		WithExec([]string{"npx", "-y", "playwright@" + version, "install", "--with-deps"})
}

func WithYarnInstall(d *dagger.Client, base *dagger.Container, yarnHostSrc *dagger.Directory) *dagger.Container {
	yarnCache := d.CacheVolume("yarn-cache")

	return base.
		WithWorkdir("/src").
		WithMountedCache("/.yarn", yarnCache).
		WithEnvVariable("YARN_CACHE_FOLDER", "/.yarn").
		WithEnvVariable("CYPRESS_INSTALL_BINARY", "0"). // Don't download Cypress binaries

		// It's important to copy all files here because the whole src directory is then copied into the test runner container
		WithDirectory("/src", yarnHostSrc).
		WithExec([]string{"corepack", "enable"}).
		WithExec([]string{"corepack", "install"}).
		WithExec([]string{"yarn", "install", "--immutable"})
}
