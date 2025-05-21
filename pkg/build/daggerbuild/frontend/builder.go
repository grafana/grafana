package frontend

import (
	"dagger.io/dagger"
)

// Builder mounts all of the necessary files to run yarn build commands and includes a yarn install exec
func Builder(d *dagger.Client, platform dagger.Platform, src *dagger.Directory, nodeVersion string, cache *dagger.CacheVolume) *dagger.Container {
	container := WithYarnCache(
		NodeContainer(d, NodeImage(nodeVersion), platform),
		cache,
	).
		WithDirectory("/src",
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

	// TODO: Should figure out exactly what we can include without all the extras so we can take advantage of caching better.
	// This had to be commented because storybook builds on branches older than 10.1.x were failing.

	// container = containers.WithDirectories(container, map[string]*dagger.Directory{
	// 	".yarn":           src.Directory(".yarn"),
	// 	"packages":        src.Directory("packages"),
	// 	"plugins-bundled": src.Directory("plugins-bundled"),
	// 	"public":          src.Directory("public"),
	// 	"scripts":         src.Directory("scripts"),
	// })

	// container = containers.WithFiles(container, map[string]*dagger.File{
	// 	"package.json": src.File("package.json"),
	// 	"lerna.json":   src.File("lerna.json"),
	// 	"yarn.lock":    src.File("yarn.lock"),
	// 	".yarnrc.yml":  src.File(".yarnrc.yml"),
	// })

	// This yarn install is ran just to rebuild the yarn pnp files; all of the dependencies should be in the cache by now
	return container.WithExec([]string{"yarn", "install", "--immutable"})
}
