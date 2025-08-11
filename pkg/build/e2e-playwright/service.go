package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"dagger.io/dagger"
)

type GrafanaServiceOpts struct {
	HostSrc           *dagger.Directory
	FrontendContainer *dagger.Container
	GrafanaTarGz      *dagger.File
	License           *dagger.File
}

func GrafanaService(ctx context.Context, d *dagger.Client, opts GrafanaServiceOpts) (*dagger.Service, error) {
	testPlugins := opts.FrontendContainer.
		WithDirectory("e2e-playwright/test-plugins", opts.HostSrc.Directory("./e2e-playwright/test-plugins")).
		WithDirectory("packages/grafana-plugin-configs", opts.HostSrc.Directory("./packages/grafana-plugin-configs")).
		WithExec([]string{"yarn", "e2e:plugin:build"})

	container := d.Container().From("alpine:3").
		WithExec([]string{"apk", "add", "--no-cache", "bash", "tar", "netcat-openbsd", "util-linux"}).
		WithMountedFile("/src/grafana.tar.gz", opts.GrafanaTarGz).
		WithExec([]string{"mkdir", "-p", "/src/grafana"}).
		WithExec([]string{"tar", "--strip-components=1", "-xzf", "/src/grafana.tar.gz", "-C", "/src/grafana"}).
		WithDirectory("/src/grafana/devenv", opts.HostSrc.Directory("./devenv")).
		WithDirectory("/src/grafana/e2e-playwright/test-plugins", testPlugins.Directory("./e2e-playwright/test-plugins")).
		WithDirectory("/src/grafana/scripts", opts.HostSrc.Directory("./scripts")).
		WithWorkdir("/src/grafana").
		// Only set config variables here that are specific to the dagger/GHA runner.
		// Prefer to configure scripts/grafana-server/custom.ini instead so they're also used
		// when running locally.
		WithEnvVariable("GF_SERVER_HTTP_PORT", fmt.Sprint(grafanaPort)).
		WithExposedPort(grafanaPort)

	var licenseArg string
	if opts.License != nil {
		licenseArg = "/src/license.jwt"
		container = container.WithMountedFile(licenseArg, opts.License)
	}

	// We add all GF_ environment variables to allow for overriding Grafana configuration.
	// It is unlikely the runner has any such otherwise.
	for _, env := range os.Environ() {
		if strings.HasPrefix(env, "GF_") {
			parts := strings.SplitN(env, "=", 2)
			container = container.WithEnvVariable(parts[0], parts[1])
		}
	}

	svc := container.AsService(dagger.ContainerAsServiceOpts{Args: []string{"bash", "scripts/grafana-server/start-server", licenseArg}})

	return svc, nil
}
