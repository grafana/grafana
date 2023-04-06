package main

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/build/env"
	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
	"github.com/urfave/cli/v2"
)

// PublishStaticAssetsAction Action implements the sub-command "artifacts static-assets".
func PublishStaticAssetsAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	staticAssetEditions, err := env.RequireListWithEnvFallback(c, "static-asset-editions", "STATIC_ASSET_EDITIONS")
	if err != nil {
		return err
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("error connecting to gcp, %q", err)
	}

	cfg := publishConfig{
		srcBucket:           c.String("src-bucket"),
		staticAssetsBucket:  c.String("static-assets-bucket"),
		staticAssetEditions: staticAssetEditions,
		security:            c.Bool("security"),
		tag:                 strings.TrimPrefix(c.String("tag"), "v"),
	}

	gcs, err := storage.New()
	if err != nil {
		return err
	}
	bucket := gcs.Bucket(cfg.staticAssetsBucket)

	for _, edition := range staticAssetEditions {
		if err := gcs.CopyRemoteDir(c.Context, gcs.Bucket(fmt.Sprintf("%s", cfg.srcBucket)), fmt.Sprintf("artifacts/static-assets/%s/%s", edition, cfg.tag), bucket, fmt.Sprintf("%s/%s", edition, cfg.tag)); err != nil {
			return err
		}
	}

	return nil
}
