package docker

import (
	"context"
	"fmt"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/e2e"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
)

// Verify uses the given package (.docker.tar.gz) and grafana source code (src) to run the e2e smoke tests.
// the returned directory is the e2e artifacts created by cypress (screenshots and videos).
func Verify(
	ctx context.Context,
	d *dagger.Client,
	image *dagger.File,
	src *dagger.Directory,
	yarnCache *dagger.CacheVolume,
	distro backend.Distribution,
) error {
	nodeVersion, err := frontend.NodeVersion(d, src).Stdout(ctx)
	if err != nil {
		return fmt.Errorf("failed to get node version from source code: %w", err)
	}

	var (
		platform = backend.Platform(distro)
	)

	// This grafana service runs in the background for the e2e tests
	service := d.Container(dagger.ContainerOpts{
		Platform: platform,
	}).
		WithMountedTemp("/var/lib/grafana/plugins", dagger.ContainerWithMountedTempOpts{}).
		Import(image).
		WithEnvVariable("GF_LOG_LEVEL", "error").
		WithExposedPort(3000)

		// TODO: Add LICENSE to containers and implement validation
	container := e2e.ValidatePackage(d, service.AsService(), src, yarnCache, nodeVersion)
	_, err = containers.ExitError(ctx, container)
	return err
}
