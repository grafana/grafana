package docker

import (
	"context"
	"fmt"

	"dagger.io/dagger"
)

func PublishPackageImage(ctx context.Context, d *dagger.Client, pkg *dagger.File, tag, username, password, registry string) (string, error) {
	return d.Container().From("docker").
		WithFile("grafana.img", pkg).
		WithSecretVariable("DOCKER_USERNAME", d.SetSecret("docker-username", username)).
		WithSecretVariable("DOCKER_PASSWORD", d.SetSecret("docker-password", password)).
		WithUnixSocket("/var/run/docker.sock", d.Host().UnixSocket("/var/run/docker.sock")).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("docker login %s -u $DOCKER_USERNAME -p $DOCKER_PASSWORD", registry)}).
		WithExec([]string{"/bin/sh", "-c", "docker load -i grafana.img | awk -F 'Loaded image: ' '{print $2}' > /tmp/image_tag"}).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("docker tag $(cat /tmp/image_tag) %s", tag)}).
		WithExec([]string{"docker", "push", tag}).
		Stdout(ctx)
}

func PublishManifest(ctx context.Context, d *dagger.Client, manifest string, tags []string, username, password, registry string) (string, error) {
	return d.Container().From("docker").
		WithUnixSocket("/var/run/docker.sock", d.Host().UnixSocket("/var/run/docker.sock")).
		WithSecretVariable("DOCKER_USERNAME", d.SetSecret("docker-username", username)).
		WithSecretVariable("DOCKER_PASSWORD", d.SetSecret("docker-password", password)).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("docker login %s -u $DOCKER_USERNAME -p $DOCKER_PASSWORD", registry)}).
		WithExec(append([]string{"docker", "manifest", "create", manifest}, tags...)).
		WithExec([]string{"docker", "manifest", "push", manifest}).
		Stdout(ctx)
}
