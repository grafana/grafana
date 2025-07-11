package golang

import (
	"fmt"

	"dagger.io/dagger"
)

func DownloadURL(version, arch string) string {
	return fmt.Sprintf("https://go.dev/dl/go%s.linux-%s.tar.gz", version, arch)
}

func Container(d *dagger.Client, platform dagger.Platform, version string) *dagger.Container {
	opts := dagger.ContainerOpts{
		Platform: platform,
	}

	goImage := fmt.Sprintf("golang:%s-alpine", version)

	return d.Container(opts).From(goImage)
}

func WithCachedGoDependencies(container *dagger.Container, cache *dagger.CacheVolume) *dagger.Container {
	return container.
		WithEnvVariable("GOMODCACHE", "/go/pkg/mod").
		WithMountedCache("/go/pkg/mod", cache).
		WithExec([]string{"ls", "-al", "/go/pkg/mod"})
}
