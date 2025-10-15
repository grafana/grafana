package frontend

import "dagger.io/dagger"

// Storybook returns a dagger.Directory which contains the built storybook server.
func Storybook(builder *dagger.Container, src *dagger.Directory, version string, nodeModules *dagger.Directory) *dagger.Directory {
	return WithNodeModules(WithFrontendSource(builder, src), nodeModules).
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"yarn", "run", "storybook:build"}).
		Directory("./packages/grafana-ui/dist/storybook")
}
