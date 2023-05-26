package main

import (
	"log"
	"path/filepath"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
)

// StoreStorybook implements the sub-command "store-storybook".
func StoreStorybook(c *cli.Context) error {
	deployment := c.String("deployment")

	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	buildConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return err
	}

	storybookBucket := buildConfig.Buckets.Storybook
	srcPath := buildConfig.Buckets.StorybookSrcDir
	srcPath = filepath.Join(srcPath, deployment)

	gcs, err := storage.New()
	if err != nil {
		return err
	}
	bucket := gcs.Bucket(storybookBucket)

	if err := gcs.DeleteDir(c.Context, bucket, srcPath); err != nil {
		return err
	}

	log.Printf("Successfully cleaned source: %s/%s\n", storybookBucket, srcPath)

	if err := gcs.CopyLocalDir(c.Context, "packages/grafana-ui/dist/storybook", bucket, srcPath, true); err != nil {
		return err
	}

	log.Printf("Successfully stored storybook to: %s/%s!\n", storybookBucket, srcPath)

	return nil
}
