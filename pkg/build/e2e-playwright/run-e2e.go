package main

import (
	"context"
	"fmt"
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

func RunTest(
	ctx context.Context,
	d *dagger.Client,
	grafanaService *dagger.Service,
) (*dagger.Container, error) {

	// Explicitly only the files u'sed by e2e tests
	hostSrc := d.Host().Directory(".", dagger.HostDirectoryOpts{
		Include: []string{
			// Include all files for a valid yarn workspace install
			"package.json",
			"yarn.lock",
			".yarnrc.yml",
			".yarn",
			"packages/*/package.json",
			"public/app/plugins/*/*/package.json",
			"e2e/test-plugins/*/package.json",
			".nvmrc",
			"public/app/types/*.d.ts",

			// packages we use in playwright tests
			"packages",

			// e2e files
			"e2e-playwright",
		},
		Exclude: []string{
			"packages/*/dist",
		},
	})

	nodeVersion, err := NodeVersion(d, hostSrc.File(".nvmrc")).Stdout(ctx)
	if err != nil {
		return nil, err
	}

	yarnCache := d.CacheVolume("yarn-cache")
	yarnCacheDir := "/yarn-cache"

	pa11yContainer := d.Container().From(NodeImage(nodeVersion)).
		WithExec([]string{"npx", "-y", "playwright@1.52.0", "install", "--with-deps"}). // TODO: sync version from package.json
		WithWorkdir("/src").
		WithDirectory("/src", hostSrc).
		WithMountedCache(yarnCacheDir, yarnCache).
		WithExec([]string{"corepack", "enable"}).
		WithExec([]string{"corepack", "install"}).
		WithEnvVariable("YARN_CACHE_FOLDER", yarnCacheDir).
		WithExec([]string{"yarn", "config", "get", "cacheFolder"}).
		WithExec([]string{"yarn", "install", "--immutable"}).
		// WithExec([]string{"yarn", "e2e:plugin:build"}).
		WithEnvVariable("HOST", grafanaHost).
		WithEnvVariable("PORT", fmt.Sprint(grafanaPort)).
		WithExec([]string{"yarn", "packages:build"}).
		WithExec([]string{"yarn", "e2e:playwright"})

	return pa11yContainer, nil
}
