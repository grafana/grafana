package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"path/filepath"
	"strings"

	"dagger.io/dagger"
)

func main() {
	var (
		dir     = flag.String("dir", ".", "The grafana directory")
		version = flag.String("version", "", "Use the '-version' flag to manually set the version")
		ctx     = context.Background()
	)
	flag.Parse()
	if *version == "" {
		log.Fatalln("-version must be set")
	}

	d, err := dagger.Connect(ctx)
	if err != nil {
		panic(err)
	}

	src := d.Host().Directory(filepath.Clean(*dir), dagger.HostDirectoryOpts{
		Include: []string{
			".nvmrc",
			".yarn",
			".yarnrc.yml",
			"nx.json",
			"project.json",
			"lerna.json",
			"**/package.json",
			"**/yarn.lock",
		},
	})
	nodeVersion, err := NodeVersion(d, src).Stdout(ctx)
	if err != nil {
		log.Fatalln("error getting node version from '.nvmrc':", err)
	}

	// Update version(s)
	updated := WithUpdatedVersion(d, src, nodeVersion, *version)
	log.Println("Exporting directory")
	if _, err := updated.Export(ctx, filepath.Clean(*dir)); err != nil {
		log.Fatalln("error exporting directory", err)
	}
	log.Println("Done exporting directory")
}

// NodeVersion a container whose `stdout` will return the node version from the '.nvmrc' file in the directory 'src'.
func NodeVersion(d *dagger.Client, src *dagger.Directory) *dagger.Container {
	return d.Container().From("alpine").
		WithMountedFile("/src/.nvmrc", src.File(".nvmrc")).
		WithWorkdir("/src").
		WithExec([]string{"cat", ".nvmrc"})
}

func WithUpdatedVersion(d *dagger.Client, src *dagger.Directory, nodeVersion, version string) *dagger.Directory {
	nodeVersion = strings.TrimPrefix(strings.TrimSpace(nodeVersion), "v")
	image := fmt.Sprintf("node:%s", nodeVersion)

	return d.Container().From(image).
		WithDirectory("/src", src).
		WithWorkdir("/src").
		WithExec([]string{"yarn", "install"}).
		WithExec([]string{"npm", "version", version, "--no-git-tag-version"}).
		WithExec([]string{"yarn", "run", "lerna", "version", version, "--no-push", "--no-git-tag-version", "--force-publish", "--exact", "--yes"}).
		WithExec([]string{"yarn", "install"}).
		WithExec([]string{"yarn", "prettier:write"}).
		Directory("/src").
		WithoutDirectory("node_modules")
}
