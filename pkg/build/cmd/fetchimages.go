package main

import (
	"fmt"
	"log"
	"os/exec"
	"path/filepath"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/docker"
	"github.com/grafana/grafana/pkg/build/gcloud"
)

const (
	alpine = "alpine"
	ubuntu = "ubuntu"
)

// GetImageFiles returns the list of image (.img, but should be .tar because they are tar archives) files that are
// created in the 'tag' process and stored in the prerelease bucket, waiting to be released.
func GetImageFiles(grafana string, version string, architectures []config.Architecture) []string {
	bases := []string{alpine, ubuntu}
	images := []string{}
	for _, base := range bases {
		for _, arch := range architectures {
			image := fmt.Sprintf("%s-%s-%s.img", grafana, version, arch)
			if base == "ubuntu" {
				image = fmt.Sprintf("%s-%s-ubuntu-%s.img", grafana, version, arch)
			}

			images = append(images, image)
		}
	}

	return images
}

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

	grafana := "grafana"
	if cfg.Edition == "enterprise" {
		grafana = "grafana-enterprise"
	}
	if cfg.Edition == "enterprise2" {
		grafana = "grafana-enterprise2"
	}
	if cfg.Edition == "grafana" || cfg.Edition == "oss" {
		grafana = "grafana-oss"
	}

	baseURL := fmt.Sprintf("gs://%s/%s/", cfg.Bucket, cfg.Tag)
	images := GetImageFiles(grafana, cfg.Tag, cfg.Archs)

	log.Printf("Fetching images [%v]", images)

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return err
	}
	if err := DownloadImages(baseURL, images, "."); err != nil {
		return err
	}
	if err := LoadImages(images, "."); err != nil {
		return err
	}
	return nil
}

// LoadImages uses the `docker load -i` command to load the image tar file into the docker daemon so that it can be
// tagged and pushed.
func LoadImages(images []string, source string) error {
	p := filepath.Clean(source)
	for _, image := range images {
		image := filepath.Join(p, image)
		log.Println("Loading image", image)
		//nolint:gosec
		cmd := exec.Command("docker", "load", "-i", image)
		cmd.Dir = "."
		out, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("out: %s\n", out)
			return fmt.Errorf("error loading image: %q", err)
		}
		log.Println("Loaded image", image)
	}
	log.Println("Images successfully loaded!")
	return nil
}

func DownloadImages(baseURL string, images []string, destination string) error {
	for _, image := range images {
		p := baseURL + image
		log.Println("Downloading image", p)
		//nolint:gosec
		cmd := exec.Command("gsutil", "-m", "cp", "-r", p, destination)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("failed to download: %w\n%s", err, out)
		}
	}
	return nil
}
