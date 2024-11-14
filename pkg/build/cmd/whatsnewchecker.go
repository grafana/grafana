package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/urfave/cli/v2"
	"golang.org/x/mod/semver"
)

const GrafanaDir = "."

var whatsNewRegex = regexp.MustCompile(`^.*whats-new-in-(v\d*-[\d+]*)`)

type PackageJSON struct {
	Grafana Grafana `json:"grafana"`
	Version string  `json:"version"`
}

type Grafana struct {
	WhatsNewUrl string `json:"whatsNewUrl"`
}

func WhatsNewChecker(c *cli.Context) error {
	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	if metadata.ReleaseMode.IsTest {
		fmt.Println("test mode, skipping check")
		return nil
	}
	if metadata.ReleaseMode.Mode != config.TagMode {
		return fmt.Errorf("non-tag pipeline, exiting")
	}

	tag := fmt.Sprintf("v%s", metadata.GrafanaVersion)

	if !semver.IsValid(tag) {
		return fmt.Errorf("non-semver compatible version %s, exiting", tag)
	}

	majorMinorDigits := strings.Replace(semver.MajorMinor(tag), ".", "-", 1)

	pkgJSONPath := filepath.Join(GrafanaDir, "package.json")
	//nolint:gosec
	pkgJSONB, err := os.ReadFile(pkgJSONPath)
	if err != nil {
		return fmt.Errorf("failed to read %q: %w", pkgJSONPath, err)
	}

	var pkgObj PackageJSON
	if err := json.Unmarshal(pkgJSONB, &pkgObj); err != nil {
		return fmt.Errorf("failed decoding %q: %w", pkgJSONPath, err)
	}

	whatsNewSplit := whatsNewRegex.FindStringSubmatch(pkgObj.Grafana.WhatsNewUrl)
	whatsNewVersion := whatsNewSplit[1]

	if whatsNewVersion != majorMinorDigits {
		return fmt.Errorf("whatsNewUrl in package.json needs to be updated to %s/", strings.Replace(whatsNewSplit[0], whatsNewVersion, majorMinorDigits, 1))
	}

	return nil
}
