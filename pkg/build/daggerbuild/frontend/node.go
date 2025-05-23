package frontend

import (
	"fmt"
	"strings"

	"dagger.io/dagger"
)

// NodeVersionContainer returns a container whose `stdout` will return the node version from the '.nvmrc' file in the directory 'src'.
func NodeVersion(d *dagger.Client, src *dagger.Directory) *dagger.Container {
	return d.Container().From("alpine:3.17").
		WithMountedDirectory("/src", src).
		WithWorkdir("/src").
		WithExec([]string{"cat", ".nvmrc"})
}

func NodeImage(version string) string {
	return fmt.Sprintf("node:%s-slim", strings.TrimPrefix(strings.TrimSpace(version), "v"))
}

// NodeContainer returns a docker container with everything set up that is needed to build or run frontend tests.
func NodeContainer(d *dagger.Client, base string, platform dagger.Platform) *dagger.Container {
	container := d.Container(dagger.ContainerOpts{
		Platform: platform,
	}).From(base).
		WithExec([]string{"apt-get", "update", "-yq"}).
		WithExec([]string{"apt-get", "install", "-yq", "make", "git", "g++", "python3"}).
		WithEnvVariable("NODE_OPTIONS", "--max_old_space_size=8000")

	return container
}
