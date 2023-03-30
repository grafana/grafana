package main

import (
	"log"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/docker"
	"github.com/grafana/grafana/pkg/build/gcloud"
)

func BuildDocker(c *cli.Context) error {
	if err := docker.Init(); err != nil {
		return err
	}

	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	useUbuntu := c.Bool("ubuntu")
	buildConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return err
	}

	shouldSave := buildConfig.Docker.ShouldSave
	if shouldSave {
		if err := gcloud.ActivateServiceAccount(); err != nil {
			return err
		}
	}

	edition := config.Edition(c.String("edition"))

	version := metadata.GrafanaVersion

	log.Printf("Building Docker images, version %s, %s edition, Ubuntu based: %v...", version, edition,
		useUbuntu)

	for _, arch := range buildConfig.Docker.Architectures {
		if _, err := docker.BuildImage(version, arch, ".", useUbuntu, shouldSave, edition); err != nil {
			return cli.Exit(err.Error(), 1)
		}
	}

	log.Println("Successfully built Docker images!")
	return nil
}
