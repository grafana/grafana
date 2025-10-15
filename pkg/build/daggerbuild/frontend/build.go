package frontend

import (
	"fmt"

	"dagger.io/dagger"
)

func WithFrontendSource(c *dagger.Container, src *dagger.Directory) *dagger.Container {
	return c.WithDirectory("/src",
		src.
			WithoutFile("go.mod").
			WithoutFile("go.sum").
			WithoutFile("go.work").
			WithoutFile("go.work.sum").
			WithoutDirectory("devenv").
			WithoutDirectory(".github").
			WithoutDirectory("docs").
			WithoutDirectory("pkg").
			WithoutDirectory("apps").
			WithoutDirectory(".nx"),
		dagger.ContainerWithDirectoryOpts{
			Exclude: []string{
				"*drone*",
				"*.go",
				"*.md",
			},
		},
	).
		WithWorkdir("/src")
}

func WithNodeModules(c *dagger.Container, nodeModules *dagger.Directory) *dagger.Container {
	return c.WithMountedDirectory("/src/node_modules", nodeModules)
}

func Build(builder *dagger.Container, version string, src *dagger.Directory, nodeModules *dagger.Directory) *dagger.Directory {
	public := WithNodeModules(WithFrontendSource(builder, src), nodeModules).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("yarn lerna version %s --exact --no-git-tag-version --no-push --force-publish -y", version)}).
		WithExec([]string{"yarn", "run", "build"}).
		WithExec([]string{"/bin/sh", "-c", "find /src/public -type d -name node_modules -print0 | xargs -0 rm -rf"}).
		Directory("/src/public")

	return public
}

func BuildPlugins(builder *dagger.Container, src *dagger.Directory, nodeModules *dagger.Directory) *dagger.Directory {
	public := WithNodeModules(WithFrontendSource(builder, src), nodeModules).
		WithExec([]string{"/bin/sh", "-c", `if [ -d /src/plugins-bundled ]; then yarn run plugins:build-bundled; else mkdir /src/plugins-bundled; fi`}).
		WithExec([]string{"/bin/sh", "-c", "find /src/plugins-bundled -type d -name node_modules -print0 | xargs -0 rm -rf"}).
		Directory("/src/plugins-bundled")

	return public
}

// WithYarnCache mounts the given YarnCacheDir in the provided container
func WithYarnCache(container *dagger.Container, vol *dagger.CacheVolume) *dagger.Container {
	yarnCacheDir := "/yarn/cache"
	c := container.WithEnvVariable("YARN_CACHE_FOLDER", yarnCacheDir)
	return c.WithMountedCache(yarnCacheDir, vol)
}
