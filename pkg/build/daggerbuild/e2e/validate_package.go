package e2e

import (
	"context"
	"fmt"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
)

// Playwright Container returns a docker container with everything set up that is needed to build or run e2e tests.
// It reads the package.json from `src` to determine the playwright version, which forces a dag evaluation.
func PlaywrightContainer(ctx context.Context, d *dagger.Client, src *dagger.Directory) (*dagger.Container, error) {
	playwrightVersion, err := d.Container().From("alpine").
		WithMountedFile("/src/package.json", src.File("package.json")).
		WithEntrypoint([]string{}).
		WithExec([]string{"apk", "add", "jq"}).
		WithExec([]string{"/bin/sh", "-c", `jq -r '.devDependencies["@playwright/test"]' /src/package.json`}).
		Stdout(ctx)

	if err != nil {
		return nil, err
	}

	image := fmt.Sprintf("mcr.microsoft.com/playwright:v%s", strings.TrimSpace(playwrightVersion))
	container := d.Container().From(image).WithEntrypoint([]string{})
	return container, nil
}

func ValidatePackage(ctx context.Context, d *dagger.Client, service *dagger.Service, src *dagger.Directory, yarnCacheVolume *dagger.CacheVolume, nodeVersion string) (*dagger.Container, error) {
	// The cypress container should never be cached
	c, err := PlaywrightContainer(ctx, d, src)
	if err != nil {
		return nil, err
	}
	c = frontend.WithYarnCache(c, yarnCacheVolume)

	return c.WithDirectory("/src", src).
		WithWorkdir("/src").
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithServiceBinding("grafana", service).
		WithEnvVariable("GRAFANA_URL", "http://grafana:3000").
		WithExec([]string{"yarn", "e2e:acceptance"}), nil
}
