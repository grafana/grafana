package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/droneutil"
	"github.com/urfave/cli/v2"
)

func GenerateMetadata(c *cli.Context) (config.Metadata, error) {
	var metadata config.Metadata
	version := ""

	event, err := droneutil.GetDroneEventFromEnv()
	if err != nil {
		return config.Metadata{}, err
	}

	tag, ok := os.LookupEnv("DRONE_TAG")
	if !ok {
		fmt.Println("DRONE_TAG envvar not present, %w", err)
	}

	var releaseMode config.ReleaseMode
	switch event {
	case string(config.PullRequestMode):
		releaseMode = config.ReleaseMode{Mode: config.PullRequestMode}
	case config.Push:
		mode, err := config.CheckDroneTargetBranch()
		if err != nil {
			return config.Metadata{}, err
		}
		releaseMode = config.ReleaseMode{Mode: mode}
	case config.Custom:
		if edition, _ := os.LookupEnv("EDITION"); edition == string(config.EditionEnterprise2) {
			releaseMode = config.ReleaseMode{Mode: config.TagMode}
			if tag != "" {
				version = strings.TrimPrefix(tag, "v")
			}
			break
		}
		mode, err := config.CheckDroneTargetBranch()
		if err != nil {
			return config.Metadata{}, err
		}
		// if there is a custom event targeting the main branch, that's an enterprise downstream build
		if mode == config.MainBranch {
			releaseMode = config.ReleaseMode{Mode: config.CustomMode}
		} else {
			releaseMode = config.ReleaseMode{Mode: mode}
		}
	case config.Tag, config.Promote:
		if tag == "" {
			return config.Metadata{}, fmt.Errorf("DRONE_TAG envvar not present for a tag/promotion event, %w", err)
		}
		version = strings.TrimPrefix(tag, "v")
		mode, err := config.CheckSemverSuffix()
		if err != nil {
			return config.Metadata{}, err
		}
		releaseMode = mode
	case config.Cronjob:
		releaseMode = config.ReleaseMode{Mode: config.CronjobMode}
	}

	if version == "" {
		version, err = generateVersionFromBuildID()
		if err != nil {
			return config.Metadata{}, err
		}
	}

	currentCommit, err := config.GetDroneCommit()
	if err != nil {
		return config.Metadata{}, err
	}
	metadata = config.Metadata{
		GrafanaVersion: version,
		ReleaseMode:    releaseMode,
		GrabplVersion:  c.App.Version,
		CurrentCommit:  currentCommit,
	}

	fmt.Printf("building Grafana version: %s, release mode: %+v", metadata.GrafanaVersion, metadata.ReleaseMode)

	return metadata, nil
}

func generateVersionFromBuildID() (string, error) {
	buildID, ok := os.LookupEnv("DRONE_BUILD_NUMBER")
	if !ok {
		return "", fmt.Errorf("unable to get DRONE_BUILD_NUMBER environmental variable")
	}
	var err error
	version, err := config.GetGrafanaVersion(buildID, ".")
	if err != nil {
		return "", err
	}
	return version, nil
}
