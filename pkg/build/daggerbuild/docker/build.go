package docker

import (
	"fmt"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
)

type BuildOpts struct {
	// Dockerfile is the path to the dockerfile with the '-f' command.
	// If it's not provided, then the docker command will default to 'Dockerfile' in `pwd`.
	Dockerfile string

	// Tags are provided as the '-t' argument, and can include the registry domain as well as the repository.
	// Docker build supports building the same image with multiple tags.
	// You might want to also include a 'latest' version of the tag.
	Tags []string
	// BuildArgs are provided to the docker command as '--build-arg'
	BuildArgs []string
	// Set the target build stage to build as '--target'
	Target string

	// Platform, if set to the non-default value, will use buildkit's emulation to build the docker image. This can be useful if building a docker image for a platform that doesn't match the host platform.
	Platform dagger.Platform
}

func Builder(d *dagger.Client, socket *dagger.Socket, targz *dagger.File) *dagger.Container {
	extracted := containers.ExtractedArchive(d, targz)

	// Instead of supplying the Platform argument here, we need to tell the host docker socket that it needs to build with the given platform.
	return d.Container().From("docker").
		WithUnixSocket("/var/run/docker.sock", socket).
		WithWorkdir("/src").
		WithMountedFile("/src/Dockerfile", extracted.File("Dockerfile")).
		WithMountedFile("/src/packaging/docker/run.sh", extracted.File("packaging/docker/run.sh")).
		WithMountedFile("/src/grafana.tar.gz", targz)
}

func Build(d *dagger.Client, builder *dagger.Container, opts *BuildOpts) *dagger.Container {
	args := []string{"docker", "buildx", "build"}
	if p := opts.Platform; p != "" {
		args = append(args, fmt.Sprintf("--platform=%s", string(p)))
	}
	dockerfile := opts.Dockerfile
	if dockerfile == "" {
		dockerfile = "Dockerfile"
	}

	args = append(args, ".", "-f", dockerfile)

	for _, v := range opts.BuildArgs {
		args = append(args, fmt.Sprintf("--build-arg=%s", v))
	}

	for _, v := range opts.Tags {
		args = append(args, "-t", v)
	}

	if opts.Target != "" {
		args = append(args, "--target", opts.Target)
	}

	return builder.WithExec(args)
}

func Save(builder *dagger.Container, opts *BuildOpts) *dagger.File {
	return builder.WithExec([]string{"docker", "save", opts.Tags[0], "-o", "image.tar.gz"}).File("image.tar.gz")
}
