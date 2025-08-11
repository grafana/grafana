package arguments

import (
	"github.com/grafana/grafana/pkg/build/daggerbuild/docker"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

var (
	DockerRegistryFlag = &cli.StringFlag{
		Name:  "registry",
		Usage: "Prefix the image name with the registry provided",
		Value: "docker.io",
	}
	DockerOrgFlag = &cli.StringFlag{
		Name:  "org",
		Usage: "Overrides the organization of the images",
		Value: "grafana",
	}
	AlpineImageFlag = &cli.StringFlag{
		Name:  "alpine-base",
		Usage: "The image or image alias specified in the Dockerfile to be used as the base image when building the Alpine version of the Grafana docker image.",
		Value: "alpine-base",
	}
	UbuntuImageFlag = &cli.StringFlag{
		Name:  "ubuntu-base",
		Usage: "The image or image alias specified in the Dockerfile to be used as the base image when building the Ubuntu version of the Grafana docker image",
		Value: "ubuntu-base",
	}
	TagFormatFlag = &cli.StringFlag{
		Name:  "tag-format",
		Usage: "Provide a go template for formatting the docker tag(s) for images with an Alpine base",
		Value: docker.DefaultTagFormat,
	}
	UbuntuTagFormatFlag = &cli.StringFlag{
		Name:  "ubuntu-tag-format",
		Usage: "Provide a go template for formatting the docker tag(s) for images with a ubuntu base",
		Value: docker.DefaultUbuntuTagFormat,
	}
	BoringTagFormatFlag = &cli.StringFlag{
		Name:  "boring-tag-format",
		Usage: "Provide a go template for formatting the docker tag(s) for the boringcrypto build of Grafana Enterprise",
		Value: docker.DefaultBoringTagFormat,
	}

	ProDockerRegistryFlag = &cli.StringFlag{
		Name:  "pro-registry",
		Usage: "Prefix the image name with the registry provided",
		Value: "docker.io",
	}
	ProDockerOrgFlag = &cli.StringFlag{
		Name:  "pro-org",
		Usage: "Overrides the organization of the images",
		Value: "grafana",
	}
	ProDockerRepoFlag = &cli.StringFlag{
		Name:  "pro-repo",
		Usage: "Overrides the docker repository of the built images",
		Value: "grafana-pro",
	}

	EntDockerRegistryFlag = &cli.StringFlag{
		Name:  "docker-enterprise-registry",
		Usage: "Prefix the image name with the registry provided",
		Value: "docker.io",
	}
	EntDockerOrgFlag = &cli.StringFlag{
		Name:  "docker-enterprise-org",
		Usage: "Overrides the organization of the images",
		Value: "grafana",
	}
	EntDockerRepoFlag = &cli.StringFlag{
		Name:  "docker-enterprise-repo",
		Usage: "Overrides the docker repository of the built images",
		Value: "grafana-enterprise",
	}

	HGTagFormatFlag = &cli.StringFlag{
		Name:  "hg-tag-format",
		Usage: "Provide a go template for formatting the docker tag(s) for Hosted Grafana images",
		Value: docker.DefaultHGTagFormat,
	}

	DockerRegistry  = pipeline.NewStringFlagArgument(DockerRegistryFlag)
	DockerOrg       = pipeline.NewStringFlagArgument(DockerOrgFlag)
	AlpineImage     = pipeline.NewStringFlagArgument(AlpineImageFlag)
	UbuntuImage     = pipeline.NewStringFlagArgument(UbuntuImageFlag)
	TagFormat       = pipeline.NewStringFlagArgument(TagFormatFlag)
	UbuntuTagFormat = pipeline.NewStringFlagArgument(UbuntuTagFormatFlag)
	BoringTagFormat = pipeline.NewStringFlagArgument(BoringTagFormatFlag)

	// The docker registry for Grafana Pro is often different than the one for Grafana & Enterprise
	ProDockerRegistry = pipeline.NewStringFlagArgument(ProDockerRegistryFlag)
	ProDockerOrg      = pipeline.NewStringFlagArgument(ProDockerOrgFlag)
	ProDockerRepo     = pipeline.NewStringFlagArgument(ProDockerRepoFlag)

	EntDockerRegistry = pipeline.NewStringFlagArgument(EntDockerRegistryFlag)
	EntDockerOrg      = pipeline.NewStringFlagArgument(EntDockerOrgFlag)
	EntDockerRepo     = pipeline.NewStringFlagArgument(EntDockerRepoFlag)

	HGTagFormat = pipeline.NewStringFlagArgument(HGTagFormatFlag)
)
