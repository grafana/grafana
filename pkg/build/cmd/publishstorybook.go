package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
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
		srcBucket:       c.String("src-bucket"),
		storybookBucket: c.String("storybook-bucket"),
		tag:             strings.TrimPrefix(c.String("tag"), "v"),
	}

	gcs, err := storage.New()
	if err != nil {
		return err
	}
	bucket := gcs.Bucket(cfg.storybookBucket)
	if err := gcs.CopyRemoteDir(c.Context, gcs.Bucket(cfg.srcBucket), fmt.Sprintf("artifacts/storybook/v%s", cfg.tag), bucket, cfg.tag); err != nil {
		return err
	}

	if latest, err := isLatest(cfg); err != nil && latest {
		log.Printf("Copying storybooks to latest...")
		if err := gcs.CopyRemoteDir(c.Context, gcs.Bucket(cfg.srcBucket), fmt.Sprintf("artifacts/storybook/v%s", cfg.tag), bucket, "latest"); err != nil {
			return err
		}
	} else {
		return err
	}

	return nil
}

func isLatest(cfg publishConfig) (bool, error) {
	stableVersion, err := versions.GetLatestVersion(versions.LatestStableVersionURL)
	if err != nil {
		return false, err
	}
	isLatest, err := versions.IsGreaterThanOrEqual(cfg.tag, stableVersion)
	if err != nil {
		return false, err
	}
	return isLatest, nil
}
