package e2e

import (
	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
)

func CypressImage(version string) string {
	return "cypress/included:13.10.0"
}

// CypressContainer returns a docker container with everything set up that is needed to build or run e2e tests.
func CypressContainer(d *dagger.Client, base string) *dagger.Container {
	container := d.Container().From(base).WithEntrypoint([]string{}).
		WithExec([]string{"apt-get", "update", "-yq"}).
		WithExec([]string{"apt-get", "install", "-yq", "make", "gcc"})

	return container
}

func ValidatePackage(d *dagger.Client, service *dagger.Service, src *dagger.Directory, yarnCacheVolume *dagger.CacheVolume, nodeVersion string) *dagger.Container {
	// The cypress container should never be cached
	c := CypressContainer(d, CypressImage(nodeVersion))

	c = frontend.WithYarnCache(c, yarnCacheVolume)

	return c.WithDirectory("/src", src).
		WithWorkdir("/src").
		WithServiceBinding("grafana", service).
		WithEnvVariable("HOST", "grafana").
		WithEnvVariable("PORT", "3000").
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"/bin/sh", "-c", "/src/e2e/verify-release"})
}
