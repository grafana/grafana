package e2eutil

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

// Create a container with frontend dependencies installed, ready to build plugins
// or run e2e tests.
// Theoretically we would setup Playwright in e2e.go, but to optimise layer caching
// we want it to happen before yarn install.
func WithFrontendContainer(ctx context.Context, d *dagger.Client, yarnHostSrc *dagger.Directory) (*dagger.Container, error) {
	deps, err := GetVersions(ctx, yarnHostSrc)
	if err != nil {
		return nil, err
	}

	nodeBase := WithNode(d, deps.NodeVersion)
	playwrightBase := WithPlaywright(d, nodeBase, deps.PlaywrightVersion)

	return WithYarnInstall(d, playwrightBase, yarnHostSrc), nil
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
