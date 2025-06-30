package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"dagger.io/dagger"
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

	// parse JSON in-Go, no jq needed
	var pkg struct {
		DevDependencies map[string]string `json:"devDependencies"`
	}
	if err := json.Unmarshal([]byte(pkgJSON), &pkg); err != nil {
		return Deps{}, err
	}

	return Deps{
		NodeVersion:       strings.TrimSpace(strings.TrimPrefix(nvmrc, "v")),
		PlaywrightVersion: strings.TrimSpace(pkg.DevDependencies["@playwright/test"]),
	}, nil
}

func RunTest(
	ctx context.Context,
	d *dagger.Client,
	grafanaService *dagger.Service,
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

	e2eContainer := WithYarnInstall(d, playwrightBase, yarnHostSrc).
		WithWorkdir("/src").
		WithDirectory("/src", e2eHostSrc).
		WithMountedCache(".nx", nxCache).
		WithExec([]string{"yarn", "e2e:plugin:build"}).
		WithEnvVariable("HOST", grafanaHost).
		WithEnvVariable("PORT", fmt.Sprint(grafanaPort)).
		WithServiceBinding(grafanaHost, grafanaService).
		WithEnvVariable("PLAYWRIGHT_HTML_OPEN", "never").
		WithExec([]string{"yarn", "e2e:playwright"}, dagger.ContainerWithExecOpts{
			Expect: dagger.ReturnTypeAny,
		})

	// TODO: wrap in conditional arg
	_, err = e2eContainer.Directory("/src/playwright-report").Export(ctx, "./dist/playwright-report")
	if err != nil {
		return nil, err
	}

	_, err = e2eContainer.Directory("/src/test-results").Export(ctx, "./dist/test-results")
	if err != nil {
		return nil, err
	}

	return e2eContainer, nil
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

		// It's important to copy all files here because the whole src directory is then copied into the test runner container
		WithDirectory("/src", yarnHostSrc).
		WithExec([]string{"corepack", "enable"}).
		WithExec([]string{"corepack", "install"}).
		WithExec([]string{"yarn", "install", "--immutable"})
}
