package pipelines

import (
	"context"
	"fmt"
	"log"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/git"
)

func ProImage(ctx context.Context, dc *dagger.Client, args PipelineArgs) error {
	if len(args.PackageInputOpts.Packages) > 1 {
		return fmt.Errorf("only one package is allowed: packages=%+v", args.PackageInputOpts.Packages)
	}
	packages, err := containers.GetPackages(ctx, dc, args.PackageInputOpts, args.GCPOpts)
	if err != nil {
		return fmt.Errorf("getting packages: packages=%+v %w", args.PackageInputOpts.Packages, err)
	}

	debianPackageFile := packages[0]

	log.Printf("Cloning hosted Grafana...")
	hostedGrafanaRepo, err := git.CloneWithGitHubToken(dc, args.ProImageOpts.GitHubToken, "https://github.com/grafana/hosted-grafana.git", "main")
	if err != nil {
		return fmt.Errorf("cloning hosted-grafana repo: %w", err)
	}

	socketPath := "/var/run/docker.sock"
	socket := dc.Host().UnixSocket(socketPath)

	hostedGrafanaImage := fmt.Sprintf("%s/%s:%s", args.ProImageOpts.ContainerRegistry, args.ProImageOpts.Repo, args.ProImageOpts.ImageTag)

	log.Printf("Building hosted Grafana image: %s", hostedGrafanaImage)
	container := dc.Container().From("google/cloud-sdk:433.0.0-alpine").
		WithExec([]string{
			"/bin/sh", "-c",
			"gcloud auth configure-docker --quiet",
		}).
		WithUnixSocket(socketPath, socket).
		WithDirectory("/src", hostedGrafanaRepo).
		WithFile("/src/grafana.deb", debianPackageFile).
		WithWorkdir("/src").
		WithExec([]string{
			"/bin/sh", "-c",
			"docker build --platform=linux/amd64 . -f ./cmd/hgrun/Dockerfile -t hgrun:latest",
		}).
		WithExec([]string{
			"/bin/sh", "-c",
			fmt.Sprintf("docker build --platform=linux/amd64 --build-arg=RELEASE_TYPE=%s --build-arg=GRAFANA_VERSION=%s --build-arg=HGRUN_IMAGE=hgrun:latest . -f ./docker/hosted-grafana-all/Dockerfile -t %s",
				args.ProImageOpts.ReleaseType,
				args.ProImageOpts.GrafanaVersion,
				hostedGrafanaImage,
			),
		})

	if args.ProImageOpts.Push {
		if args.ProImageOpts.ContainerRegistry == "" {
			return fmt.Errorf("--registry=<string> is required")
		}

		authenticator := containers.GCSAuth(dc, &containers.GCPOpts{
			ServiceAccountKey:       args.GCPOpts.ServiceAccountKey,
			ServiceAccountKeyBase64: args.GCPOpts.ServiceAccountKeyBase64,
		})

		authenticatedContainer, err := authenticator.Authenticate(dc, container)
		if err != nil {
			return fmt.Errorf("authenticating container with gcs auth: %w", err)
		}

		log.Printf("Pushing hosted Grafana image to registry...")
		container = authenticatedContainer.WithExec([]string{
			"/bin/sh", "-c",
			fmt.Sprintf("docker push %s", hostedGrafanaImage),
		})
	}

	if _, err := containers.ExitError(ctx, container); err != nil {
		return fmt.Errorf("container did not exit successfully: %w", err)
	}

	return nil
}
