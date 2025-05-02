package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	"dagger.io/dagger"
)

// NodeVersionContainer returns a container whose `stdout` will return the node version from the '.nvmrc' file in the directory 'src'.
func NodeVersion(d *dagger.Client, src *dagger.File) *dagger.Container {
	return d.Container().From("alpine:3").
		WithMountedFile("/src/.nvmrc", src).
		WithWorkdir("/src").
		WithExec([]string{"cat", ".nvmrc"})
}

func NodeImage(version string) string {
	return fmt.Sprintf("node:%s-slim", strings.TrimPrefix(strings.TrimSpace(version), "v"))
}

type GrafanaServiceOpts struct {
	GrafanaDir   *dagger.Directory
	GrafanaTarGz *dagger.File
	YarnCache    *dagger.CacheVolume
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

func GrafanaService(ctx context.Context, d *dagger.Client, opts GrafanaServiceOpts) (*dagger.Service, error) {
	log.Println("getting node version")
	nodeVersion, err := NodeVersion(d, opts.GrafanaDir.File(".nvmrc")).Stdout(ctx)
	if err != nil {
		return nil, err
	}
	log.Println("done getting node version")

	src := WithYarnCache(
		WithGrafanaFrontend(d.Container().From(NodeImage(nodeVersion)), opts.GrafanaDir),
		opts.YarnCache,
	).WithEnvVariable("YARN_CACHE_FOLDER", "/yarn/cache").
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"yarn", "e2e:plugin:build"})

	svc := d.Container().From("alpine").
		WithExec([]string{"apk", "add", "bash"}).
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
		WithExposedPort(3001).
		AsService(dagger.ContainerAsServiceOpts{Args: []string{"bash", "-x", "scripts/grafana-server/start-server"}})

	return svc, nil
}
