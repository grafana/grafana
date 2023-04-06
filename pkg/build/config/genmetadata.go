package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/build/droneutil"
	"github.com/urfave/cli/v2"
)

func GenerateMetadata(c *cli.Context) (Metadata, error) {
	var metadata Metadata
	version := ""

	event, err := droneutil.GetDroneEventFromEnv()
	if err != nil {
		return Metadata{}, err
	}

	tag, ok := os.LookupEnv("DRONE_TAG")
	if !ok {
		fmt.Println("DRONE_TAG envvar not present, %w", err)
	}

	var releaseMode ReleaseMode
	switch event {
	case string(PullRequestMode):
		releaseMode = ReleaseMode{Mode: PullRequestMode}
	case Push:
		mode, err := CheckDroneTargetBranch()
		if err != nil {
			return Metadata{}, err
		}
		releaseMode = ReleaseMode{Mode: mode}
	case Custom:
		if edition, _ := os.LookupEnv("EDITION"); edition == string(EditionEnterprise2) {
			releaseMode = ReleaseMode{Mode: Enterprise2Mode}
			if tag != "" {
				version = strings.TrimPrefix(tag, "v")
			}
			break
		}
		mode, err := CheckDroneTargetBranch()
		if err != nil {
			return Metadata{}, err
		}
		// if there is a custom event targeting the main branch, that's an enterprise downstream build
		if mode == MainBranch {
			releaseMode = ReleaseMode{Mode: DownstreamMode}
		} else {
			releaseMode = ReleaseMode{Mode: mode}
		}
	case Tag, Promote:
		if tag == "" {
			return Metadata{}, fmt.Errorf("DRONE_TAG envvar not present for a tag/promotion event, %w", err)
		}
		version = strings.TrimPrefix(tag, "v")
		mode, err := CheckSemverSuffix()
		if err != nil {
			return Metadata{}, err
		}
		releaseMode = mode
	case Cronjob:
		releaseMode = ReleaseMode{Mode: CronjobMode}
	}

	if version == "" {
		version, err = generateVersionFromBuildID()
		if err != nil {
			return Metadata{}, err
		}
	}

	currentCommit, err := GetDroneCommit()
	if err != nil {
		return Metadata{}, err
	}
	metadata = Metadata{
		GrafanaVersion: version,
		ReleaseMode:    releaseMode,
		GrabplVersion:  c.App.Version,
		CurrentCommit:  currentCommit,
	}

	fmt.Printf("building Grafana version: %s, release mode: %+v\n", metadata.GrafanaVersion, metadata.ReleaseMode)

	return metadata, nil
}

func generateVersionFromBuildID() (string, error) {
	buildID, ok := os.LookupEnv("DRONE_BUILD_NUMBER")
	if !ok {
		return "", fmt.Errorf("unable to get DRONE_BUILD_NUMBER environmental variable")
	}
	var err error
	version, err := GetGrafanaVersion(buildID, ".")
	if err != nil {
		return "", err
	}
	return version, nil
}
