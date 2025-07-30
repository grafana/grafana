package frontend

import (
	"context"
	"fmt"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
)

// NPMPackages versions and packs the npm packages into tarballs into `npm-packages` directory.
// It then returns the npm-packages directory as a dagger.Directory.
func NPMPackages(builder *dagger.Container, d *dagger.Client, log *slog.Logger, src *dagger.Directory, ersion string) (*dagger.Directory, error) {
	// Check if the version of Grafana uses lerna or nx to manage package versioning.
	var (
		out = fmt.Sprintf("../../npm-packages/%%s-%v.tgz", "v"+ersion)

		lernaBuild = fmt.Sprintf("yarn run packages:build && yarn lerna version %s --exact --no-git-tag-version --no-push --force-publish -y", ersion)
		lernaPack  = fmt.Sprintf("yarn lerna exec --no-private -- yarn pack --out %s", out)

		nxBuild = fmt.Sprintf("yarn run packages:build && yarn nx release version %s --no-git-commit --no-git-tag --no-stage-changes --group grafanaPackages", ersion)
		nxPack  = fmt.Sprintf("yarn nx exec --projects=$(cat nx.json | jq -r '.release.groups.grafanaPackages.projects | join(\",\")') -- yarn pack --out %s", out)
	)

	return builder.WithExec([]string{"mkdir", "-p", "npm-packages"}).
		WithEnvVariable("SHELL", "/bin/bash").
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"/bin/bash", "-c", fmt.Sprintf("if [ -f lerna.json ]; then %s; else %s; fi", lernaBuild, nxBuild)}).
		WithExec([]string{"/bin/bash", "-c", fmt.Sprintf("if [ -f lerna.json ]; then %s; else %s; fi", lernaPack, nxPack)}).
		Directory("./npm-packages"), nil
}

// PublishNPM publishes a npm package to the given destination.
func PublishNPM(ctx context.Context, d *dagger.Client, pkg *dagger.File, token, registry string, tags []string) (string, error) {
	src := containers.ExtractedArchive(d, pkg)

	version, err := containers.GetJSONValue(ctx, d, src, "package.json", "version")
	if err != nil {
		return "", err
	}

	name, err := containers.GetJSONValue(ctx, d, src, "package.json", "name")
	if err != nil {
		return "", err
	}

	tokenSecret := d.SetSecret("npm-token", token)

	c := d.Container().From(NodeImage("lts")).
		WithFile("/pkg.tgz", pkg).
		WithSecretVariable("NPM_TOKEN", tokenSecret).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("npm set //%s/:_authToken $NPM_TOKEN", registry)}).
		WithExec([]string{"npm", "publish", "/pkg.tgz", fmt.Sprintf("--registry https://%s", registry), "--tag", tags[0]})

	for _, tag := range tags[1:] {
		c = c.WithExec([]string{"npm", "dist-tag", "add", fmt.Sprintf("%s@%s", name, version), tag})
	}

	return c.Stdout(ctx)
}
