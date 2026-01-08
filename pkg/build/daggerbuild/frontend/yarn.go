package frontend

import "dagger.io/dagger"

func YarnInstall(c *dagger.Client, src *dagger.Directory, version string, cache *dagger.CacheVolume, platform dagger.Platform) *dagger.Container {
	return WithYarnCache(NodeContainer(c, NodeImage(version), platform), cache).
		WithMountedDirectory("/src", src).
		WithWorkdir("/src").
		WithExec([]string{"yarn", "install", "--immutable", "--inline-builds"})
}
