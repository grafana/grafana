package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
)

// UploadCDN implements the sub-command "upload-cdn".
func UploadCDN(c *cli.Context) error {
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

	version := metadata.GrafanaVersion
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	buildConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return err
	}

	edition := os.Getenv("EDITION")
	log.Printf("Uploading Grafana CDN Assets, version %s, %s edition...", version, edition)

	editionPath := ""

	switch config.Edition(edition) {
	case config.EditionOSS:
		editionPath = "grafana-oss"
	case config.EditionEnterprise:
		editionPath = "grafana"
	case config.EditionEnterprise2:
		editionPath = os.Getenv("ENTERPRISE2_CDN_PATH")
	default:
		panic(fmt.Sprintf("unrecognized edition %q", edition))
	}

	gcs, err := storage.New()
	if err != nil {
		return err
	}

	bucket := gcs.Bucket(buildConfig.Buckets.CDNAssets)
	srcPath := buildConfig.Buckets.CDNAssetsDir
	srcPath = filepath.Join(srcPath, editionPath, version)

	if err := gcs.DeleteDir(c.Context, bucket, srcPath); err != nil {
		return err
	}
	log.Printf("Successfully cleaned source: %s/%s\n", buildConfig.Buckets.CDNAssets, srcPath)

	if err := gcs.CopyLocalDir(c.Context, "./public", bucket, srcPath, false); err != nil {
		return err
	}

	log.Printf("Successfully uploaded cdn static assets to: %s/%s!\n", buildConfig.Buckets.CDNAssets, srcPath)

	return nil
}
