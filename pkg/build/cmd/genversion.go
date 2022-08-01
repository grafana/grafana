package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/droneutil"
	"github.com/urfave/cli/v2"
)

func GenerateVersion(c *cli.Context) error {
	version := ""
	if c.NArg() == 1 {
		version = strings.TrimPrefix(c.Args().Get(0), "v")
	} else {
		buildID := c.String("build-id")
		var err error
		version, err = config.GetGrafanaVersion(buildID, ".")
		if err != nil {
			return err
		}
	}
	event, err := droneutil.GetDroneEvent(os.Environ())
	if err != nil {
		return err
	}

	var mode config.VersionMode
	switch event {
	case "pull_request":
		mode = config.PullRequestMode
	case "push":
		releaseMode, err := config.CheckDroneTargetBranch()
		if err != nil {
			return err
		}
		mode = releaseMode
	case "tag":
		releaseMode, err := config.CheckSemverSuffix()
		if err != nil {
			return err
		}
		mode = releaseMode
	}
	metadata := config.Metadata{
		GrafanaVersion: version,
		ReleaseMode:    mode,
		GrabplVersion:  c.App.Version,
	}

	log.Printf("building Grafana version: %s, mode: %s", metadata.GrafanaVersion, metadata.ReleaseMode)

	jsonMetadata, err := json.Marshal(&metadata)
	if err != nil {
		return fmt.Errorf("error marshalling metadata, %w", err)
	}

	const distDir = "dist"
	if err := os.RemoveAll(distDir); err != nil {
		return err
	}
	if err := os.Mkdir(distDir, 0775); err != nil {
		return err
	}

	// nolint:gosec
	if err := ioutil.WriteFile(filepath.Join(distDir, "version.json"), jsonMetadata, 0664); err != nil {
		return err
	}
	return nil
}
