package main

import (
	"fmt"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
	"log"
	"strings"

	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/versions"
	"github.com/urfave/cli/v2"
)

// PublishStorybookAction Action implements the sub-command "publish-artifacts".
func PublishStorybookAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("error connecting to gcp, %q", err)
	}

	cfg := publishConfig{
		srcBucket: c.String("src-bucket"),
		security:  c.Bool("security"),
		tag:       strings.TrimPrefix(c.String("tag"), "v"),
	}

	err := copyStorybook(cfg)
	if err != nil {
		return err
	}
	return nil
}

func copyStorybook(cfg publishConfig) error {
	if cfg.security {
		log.Printf("skipping storybook copy - not needed for a security release")
		return nil
	}
	log.Printf("Copying storybooks...")
	srcURL := fmt.Sprintf("%s/artifacts/storybook/v%s/*", cfg.srcBucket, cfg.tag)
	destURL := fmt.Sprintf("%s/%s", cfg.storybookBucket, cfg.tag)
	err := storage.GCSCopy("storybook", srcURL, destURL)
	if err != nil {
		return fmt.Errorf("error copying storybook. %q", err)
	}
	stableVersion, err := versions.GetLatestVersion(versions.LatestStableVersionURL)
	if err != nil {
		return err
	}
	isLatest, err := versions.IsGreaterThanOrEqual(cfg.tag, stableVersion)
	if err != nil {
		return err
	}
	if isLatest {
		log.Printf("Copying storybooks to latest...")
		srcURL := fmt.Sprintf("%s/artifacts/storybook/v%s/*", cfg.srcBucket, cfg.tag)
		destURL := fmt.Sprintf("%s/latest", cfg.storybookBucket)
		err := storage.GCSCopy("storybook (latest)", srcURL, destURL)
		if err != nil {
			return fmt.Errorf("error copying storybook to latest. %q", err)
		}
	}

	log.Printf("Successfully copied storybook!")
	return nil
}
