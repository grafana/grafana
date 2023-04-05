package main

import (
	"fmt"
	"log"
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
	securityDestBucket, err := env.RequireStringWithEnvFallback(c, "security-dest-bucket", "SECURITY_DEST_BUCKET")
	if err != nil {
		return err
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("error connecting to gcp, %q", err)
	}

	cfg := publishConfig{
		srcBucket:           c.String("src-bucket"),
		destBucket:          c.String("dest-bucket"),
		staticAssetsBucket:  c.String("static-assets-bucket"),
		staticAssetEditions: staticAssetEditions,
		security:            c.Bool("security"),
		tag:                 strings.TrimPrefix(c.String("tag"), "v"),
	}

	if cfg.security {
		cfg.destBucket = securityDestBucket
	}

	err = copyStaticAssets(cfg)
	if err != nil {
		return err
	}
	return nil
}

func copyStaticAssets(cfg publishConfig) error {
	for _, edition := range cfg.staticAssetEditions {
		log.Printf("Copying static assets for %s", edition)
		srcURL := fmt.Sprintf("%s/artifacts/static-assets/%s/%s/*", cfg.srcBucket, edition, cfg.tag)
		destURL := fmt.Sprintf("%s/%s/%s/", cfg.staticAssetsBucket, edition, cfg.tag)
		err := storage.GCSCopy("static assets", srcURL, destURL)
		if err != nil {
			return fmt.Errorf("error copying static assets, %q", err)
		}
	}
	log.Printf("Successfully copied static assets!")
	return nil
}
