package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/droneutil"
	"github.com/urfave/cli/v2"
)

func GenerateVersions(c *cli.Context) error {
	var metadata config.Metadata
	version := ""
	if c.NArg() == 1 {
		version = strings.TrimPrefix(c.Args().Get(0), "v")
	} else {
		buildID, ok := os.LookupEnv("DRONE_BUILD_NUMBER")
		if !ok {
			return fmt.Errorf("unable to get DRONE_BUILD_NUMBER environmental variable")
		}
		var err error
		version, err = config.GetGrafanaVersion(buildID, ".")
		if err != nil {
			return err
		}
	}
	event, err := droneutil.GetDroneEventFromEnv()
	if err != nil {
		return err
	}

	var releaseMode config.ReleaseMode
	switch event {
	case string(config.PullRequestMode):
		releaseMode = config.ReleaseMode{Mode: config.PullRequestMode}
	case config.Push:
		mode, err := config.CheckDroneTargetBranch()
		if err != nil {
			return err
		}
		releaseMode = config.ReleaseMode{Mode: mode}
	case config.Custom:
		mode, err := config.CheckDroneTargetBranch()
		if err != nil {
			return err
		}
		// if there is a custom event targeting the main branch, that's an enterprise downstream build
		if mode == config.MainBranch {
			releaseMode = config.ReleaseMode{Mode: config.CustomMode}
		} else {
			releaseMode = config.ReleaseMode{Mode: mode}
		}
	case config.Tag, config.Promote:
		mode, err := config.CheckSemverSuffix()
		if err != nil {
			return err
		}
		releaseMode = mode
	}

	currentCommit, err := config.GetDroneCommit()
	if err != nil {
		return err
	}
	metadata = config.Metadata{
		GrafanaVersion: version,
		ReleaseMode:    releaseMode,
		GrabplVersion:  c.App.Version,
		CurrentCommit:  currentCommit,
	}

	fmt.Printf("building Grafana version: %s, release mode: %+v", metadata.GrafanaVersion, metadata.ReleaseMode)

	jsonMetadata, err := json.Marshal(&metadata)
	if err != nil {
		return fmt.Errorf("error marshalling metadata, %w", err)
	}

	const distDir = "dist"
	if _, err := os.Stat(distDir); os.IsNotExist(err) {
		if err := os.RemoveAll(distDir); err != nil {
			return err
		}
		if err := os.Mkdir(distDir, 0750); err != nil {
			return err
		}

		// nolint:gosec
		if err := os.WriteFile(filepath.Join(distDir, "version.json"), jsonMetadata, 0664); err != nil {
			return err
		}
	}

	return nil
}
