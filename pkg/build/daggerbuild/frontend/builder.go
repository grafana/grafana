package frontend

import (
	"dagger.io/dagger"
)

// Builder mounts all of the necessary files to run pnpm build commands and includes a pnpm install exec
func Builder(d *dagger.Client, platform dagger.Platform, src *dagger.Directory, nodeVersion string, cache *dagger.CacheVolume) *dagger.Container {
	return NodeContainer(d, NodeImage(nodeVersion), platform)
}
