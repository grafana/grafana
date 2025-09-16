package frontend

import (
	"fmt"

	"dagger.io/dagger"
)

func Build(builder *dagger.Container, version string) *dagger.Directory {
	public := builder.
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("yarn lerna version %s --exact --no-git-tag-version --no-push --force-publish -y", version)}).
		WithExec([]string{"yarn", "run", "build"}).
		WithExec([]string{"/bin/sh", "-c", "find /src/public -type d -name node_modules -print0 | xargs -0 rm -rf"}).
		Directory("/src/public")

	return public
}

func BuildPlugins(builder *dagger.Container) *dagger.Directory {
	public := builder.
		WithExec([]string{"yarn", "install", "--immutable"}).
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
