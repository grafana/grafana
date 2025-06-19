package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"dagger.io/dagger"
)

func NodeImage(version string) string {
	return fmt.Sprintf("node:%s-slim", strings.TrimPrefix(strings.TrimSpace(version), "v"))
}

type GrafanaServiceOpts struct {
	GrafanaDir   *dagger.Directory
	GrafanaTarGz *dagger.File
	License      *dagger.File
	YarnCache    *dagger.CacheVolume
	NodeVersion  string
}

func Frontend(src *dagger.Directory) *dagger.Directory {
	return src.
		WithoutFile("go.mod").
		WithoutFile("go.sum").
		WithoutFile("go.work").
		WithoutFile("go.work.sum").
		WithoutDirectory(".github").
		WithoutDirectory("docs").
		WithoutDirectory("pkg").
		WithoutDirectory("apps").
		WithoutDirectory("videos")
}

func WithGrafanaFrontend(c *dagger.Container, src *dagger.Directory) *dagger.Container {
	return c.WithDirectory("/src", Frontend(src), dagger.ContainerWithDirectoryOpts{
		Exclude: []string{
			"*drone*",
			"*.go",
			"*.md",
		},
	})
}

func WithYarnCache(c *dagger.Container, cache *dagger.CacheVolume) *dagger.Container {
	return c.
		WithWorkdir("/src").
		WithMountedCache("/yarn/cache", cache)
}

func GrafanaFrontend(d *dagger.Client, yarnCache *dagger.CacheVolume, nodeVersion string, grafanaDir *dagger.Directory) *dagger.Container {
	container := d.Container().From(NodeImage(nodeVersion))
	container = WithGrafanaFrontend(container, grafanaDir)
	return WithYarnCache(container, yarnCache).
		WithEnvVariable("YARN_CACHE_FOLDER", "/yarn/cache").
		WithExec([]string{"yarn", "install", "--immutable"})
}

func GrafanaService(ctx context.Context, d *dagger.Client, opts GrafanaServiceOpts) (*dagger.Service, error) {
	src := GrafanaFrontend(d, opts.YarnCache, opts.NodeVersion, opts.GrafanaDir)

	container := d.Container().From("alpine:3").
		WithExec([]string{"apk", "add", "--no-cache", "bash", "tar", "netcat-openbsd"}).
		WithMountedFile("/src/grafana.tar.gz", opts.GrafanaTarGz).
		WithExec([]string{"mkdir", "-p", "/src/grafana"}).
		WithExec([]string{"tar", "--strip-components=1", "-xzf", "/src/grafana.tar.gz", "-C", "/src/grafana"}).
		WithDirectory("/src/grafana/devenv", src.Directory("/src/devenv")).
		WithDirectory("/src/grafana/e2e", src.Directory("/src/e2e")).
		WithDirectory("/src/grafana/scripts", src.Directory("/src/scripts")).
		WithDirectory("/src/grafana/tools", src.Directory("/src/tools")).
		WithWorkdir("/src/grafana").
		WithEnvVariable("GF_APP_MODE", "development").
		WithEnvVariable("GF_SERVER_HTTP_PORT", "3001").
		WithEnvVariable("GF_SERVER_ROUTER_LOGGING", "1").
		WithExposedPort(3001)

	var licenseArg string
	if opts.License != nil {
		container = container.WithMountedFile("/src/license.jwt", opts.License)
		licenseArg = "/src/license.jwt"
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
