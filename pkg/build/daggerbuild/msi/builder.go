package msi

import (
	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
)

func Builder(d *dagger.Client) (*dagger.Container, error) {
	nssm := d.Container().From("busybox").
		WithExec([]string{"wget", "https://dl.grafana.com/ci/nssm-2.24.zip"}).
		WithExec([]string{"unzip", "nssm-2.24.zip"}).
		Directory("nssm-2.24")

	wix3 := d.Container().From("busybox").
		WithWorkdir("/src").
		WithExec([]string{"wget", "https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip"}).
		WithExec([]string{"unzip", "wix314-binaries.zip"}).
		WithExec([]string{"rm", "wix314-binaries.zip"}).
		Directory("/src")

	builder := d.Container().From("scottyhardy/docker-wine:stable-9.0").
		WithEntrypoint([]string{}).
		WithMountedDirectory("/src/nssm-2.24", nssm).
		WithMountedDirectory("/src/wix3", wix3).
		WithWorkdir("/src")

	return containers.WithEmbeddedFS(d, builder, "/src/resources", resources)
}
