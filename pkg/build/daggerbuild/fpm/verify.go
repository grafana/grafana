package fpm

import (
	"context"
	"fmt"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/e2e"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/gpg"
)

func VerifyDeb(ctx context.Context, d *dagger.Client, file *dagger.File, src *dagger.Directory, yarn *dagger.CacheVolume, distro backend.Distribution, enterprise bool) error {
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
	}).From("ubuntu:22.04").
		WithFile("/src/package.deb", file).
		WithExec([]string{"apt-get", "update"}).
		WithExec([]string{"apt-get", "install", "-yq", "ca-certificates"}).
		WithExec([]string{"apt-get", "install", "-yq", "/src/package.deb"}).
		WithEnvVariable("GF_LOG_LEVEL", "error").
		WithWorkdir("/usr/share/grafana")

	if err := e2e.ValidateLicense(ctx, service, "/usr/share/grafana/LICENSE", enterprise); err != nil {
		return err
	}

	svc := service.WithExposedPort(3000).AsService(dagger.ContainerAsServiceOpts{
		Args: []string{"grafana-server"},
	})

	result, err := e2e.ValidatePackage(ctx, d, svc, src, yarn, nodeVersion)
	if err != nil {
		return err
	}

	if _, err := containers.ExitError(ctx, result); err != nil {
		return err
	}

	return nil
}

func VerifyRpm(ctx context.Context, d *dagger.Client, file *dagger.File, src *dagger.Directory, yarn *dagger.CacheVolume, distro backend.Distribution, enterprise, sign bool, pubkey, privkey, passphrase string) error {
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
	}).From("redhat/ubi8:8.10-source").
		WithFile("/src/package.rpm", file).
		WithExec([]string{"yum", "install", "-y", "/src/package.rpm"}).
		WithEnvVariable("GF_LOG_LEVEL", "error").
		WithWorkdir("/usr/share/grafana")

	if err := e2e.ValidateLicense(ctx, service, "/usr/share/grafana/LICENSE", enterprise); err != nil {
		return err
	}

	service = service.
		WithExec([]string{"grafana-server"}).
		WithExposedPort(3000)

	svc := service.WithExposedPort(3000).AsService(dagger.ContainerAsServiceOpts{
		Args: []string{"grafana-server"},
	})

	result, err := e2e.ValidatePackage(ctx, d, svc, src, yarn, nodeVersion)
	if err != nil {
		return err
	}

	if _, err := containers.ExitError(ctx, result); err != nil {
		return err
	}
	if !sign {
		return nil
	}

	return gpg.VerifySignature(ctx, d, file, pubkey, privkey, passphrase)
}
