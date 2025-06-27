package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"dagger.io/dagger"
)

type GrafanaServiceOpts struct {
	HostSrc      *dagger.Directory
	GrafanaTarGz *dagger.File
	License      *dagger.File
}

func GrafanaService(ctx context.Context, d *dagger.Client, opts GrafanaServiceOpts) (*dagger.Service, error) {
	container := d.Container().From("alpine:3").
		WithExec([]string{"apk", "add", "--no-cache", "bash", "tar", "netcat-openbsd"}).
		WithMountedFile("/src/grafana.tar.gz", opts.GrafanaTarGz).
		WithExec([]string{"mkdir", "-p", "/src/grafana"}).
		WithExec([]string{"tar", "--strip-components=1", "-xzf", "/src/grafana.tar.gz", "-C", "/src/grafana"}).
		WithDirectory("/src/grafana/devenv", opts.HostSrc.Directory("./devenv")).
		WithDirectory("/src/grafana/e2e/test-plugins", opts.HostSrc.Directory("./e2e/test-plugins")).
		WithDirectory("/src/grafana/scripts", opts.HostSrc.Directory("./scripts")).
		WithWorkdir("/src/grafana").
		WithEnvVariable("GF_APP_MODE", "development").
		WithEnvVariable("GF_SERVER_HTTP_PORT", fmt.Sprint(grafanaPort)).
		WithEnvVariable("GF_SERVER_ROUTER_LOGGING", "1").
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

	svc := container.AsService(dagger.ContainerAsServiceOpts{Args: []string{"bash", "-x", "scripts/grafana-server/start-server", licenseArg}})

	return svc, nil
}
