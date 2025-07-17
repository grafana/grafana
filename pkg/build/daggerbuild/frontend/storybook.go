package frontend

import "dagger.io/dagger"

// Storybook returns a dagger.Directory which contains the built storybook server.
func Storybook(builder *dagger.Container, src *dagger.Directory, version string) *dagger.Directory {
	return builder.
		WithExec([]string{"yarn", "run", "storybook:build"}).
		Directory("./packages/grafana-ui/dist/storybook")
}
