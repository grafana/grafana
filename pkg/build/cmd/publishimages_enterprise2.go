package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/docker"
	"github.com/grafana/grafana/pkg/build/gcloud"
)

func Enterprise2(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("couldn't activate service account, err: %w", err)
	}

	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	buildConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return err
	}

	cfg := docker.Config{
		Archs:         buildConfig.Docker.Architectures,
		Distribution:  buildConfig.Docker.Distribution,
		DockerHubRepo: c.String("dockerhub-repo"),
		Tag:           metadata.GrafanaVersion,
	}

	err = dockerLoginEnterprise2()
	if err != nil {
		return err
	}

	var distributionStr []string
	for _, distribution := range cfg.Distribution {
		switch distribution {
		case alpine:
			distributionStr = append(distributionStr, "")
		case ubuntu:
			distributionStr = append(distributionStr, "-ubuntu")
		default:
			return fmt.Errorf("unrecognized distribution %q", distribution)
		}
	}

	for _, distribution := range distributionStr {
		var imageFileNames []string
		for _, arch := range cfg.Archs {
			imageFilename := fmt.Sprintf("%s:%s%s-%s", cfg.DockerHubRepo, cfg.Tag, distribution, arch)
			err := docker.PushImage(imageFilename)
			if err != nil {
				return err
			}
			imageFileNames = append(imageFileNames, imageFilename)
		}
		manifest := fmt.Sprintf("%s:%s%s", cfg.DockerHubRepo, cfg.Tag, distribution)
		args := []string{"manifest", "create", manifest}
		args = append(args, imageFileNames...)

		//nolint:gosec
		cmd := exec.Command("docker", args...)
		cmd.Env = append(os.Environ(), "DOCKER_CLI_EXPERIMENTAL=enabled")
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to create Docker manifest: %w\n%s", err, output)
		}

		err = docker.PushManifest(manifest)
		if err != nil {
			return err
		}
	}

	return nil
}

func dockerLoginEnterprise2() error {
	log.Println("Docker login...")
	cmd := exec.Command("gcloud", "auth", "configure-docker")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("error logging in to DockerHub: %s %q", out, err)
	}

	log.Println("Successful login!")
	return nil
}
