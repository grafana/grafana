package main

import (
	"fmt"
	"log"
	"os/exec"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/docker"
	"github.com/grafana/grafana/pkg/build/gcloud"
)

const (
	alpine = "alpine"
	ubuntu = "ubuntu"
)

func FetchImages(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
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
		Archs:        buildConfig.Docker.Architectures,
		Distribution: buildConfig.Docker.Distribution,
		Bucket:       buildConfig.Docker.PrereleaseBucket,
		Edition:      c.String("edition"),
		Tag:          metadata.GrafanaVersion,
	}

	edition := fmt.Sprintf("-%s", cfg.Edition)

	err = gcloud.ActivateServiceAccount()
	if err != nil {
		return err
	}

	var basesStr []string
	for _, base := range cfg.Distribution {
		switch base {
		case alpine:
			basesStr = append(basesStr, "")
		case ubuntu:
			basesStr = append(basesStr, "-ubuntu")
		default:
			return fmt.Errorf("unrecognized base %q", base)
		}
	}

	err = downloadFromGCS(cfg, basesStr, edition)
	if err != nil {
		return err
	}

	err = loadImages(cfg, basesStr, edition)
	if err != nil {
		return err
	}
	return nil
}

func loadImages(cfg docker.Config, basesStr []string, edition string) error {
	log.Println("Loading fetched image files to local docker registry...")
	log.Printf("Number of images to be loaded: %d\n", len(basesStr)*len(cfg.Archs))
	for _, base := range basesStr {
		for _, arch := range cfg.Archs {
			imageFilename := fmt.Sprintf("grafana%s-%s%s-%s.img", edition, cfg.Tag, base, arch)
			log.Printf("image file name: %s\n", imageFilename)
			//nolint:gosec
			cmd := exec.Command("docker", "load", "-i", imageFilename)
			cmd.Dir = "."
			out, err := cmd.CombinedOutput()
			if err != nil {
				log.Printf("out: %s\n", out)
				return fmt.Errorf("error loading image: %q", err)
			}
			log.Printf("Successfully loaded %s!\n %s\n", fmt.Sprintf("grafana%s-%s%s-%s", edition, cfg.Tag, base, arch), out)
		}
	}
	log.Println("Images successfully loaded!")
	return nil
}

func downloadFromGCS(cfg docker.Config, basesStr []string, edition string) error {
	log.Printf("Downloading Docker images from GCS bucket: %s\n", cfg.Bucket)

	for _, base := range basesStr {
		for _, arch := range cfg.Archs {
			src := fmt.Sprintf("gs://%s/%s/grafana%s-%s%s-%s.img", cfg.Bucket, cfg.Tag, edition, cfg.Tag, base, arch)
			args := strings.Split(fmt.Sprintf("-m cp -r %s .", src), " ")
			//nolint:gosec
			cmd := exec.Command("gsutil", args...)
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("failed to download: %w\n%s", err, out)
			}
		}
	}
	log.Printf("Successfully fetched image files from %s bucket!\n", cfg.Bucket)
	return nil
}
