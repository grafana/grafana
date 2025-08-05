package frontend

import "dagger.io/dagger"

// Storybook returns a dagger.Directory which contains the built storybook server.
func Storybook(builder *dagger.Container, src *dagger.Directory, version string) *dagger.Directory {
	return builder.
		WithEnvVariable("CI", "true").
		WithEnvVariable("NX_DAEMON", "false").
		WithEnvVariable("NX_CACHE_PROJECT_GRAPH", "false").
		WithExec([]string{"yarn", "run", "storybook:build"}).
		Directory("./packages/grafana-ui/dist/storybook")
}
