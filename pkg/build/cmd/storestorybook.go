package main

import (
	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
	"path/filepath"

	"github.com/rs/zerolog/log"
	"github.com/urfave/cli/v2"
)

// Action implements the sub-command "store-storybook".
func StoreStorybook(c *cli.Context) error {
	deployment := c.String("deployment")

	metadata, err := GenerateMetadata(c)
	if err != nil {
		return err
	}

	verMode, err := config.GetVersion(metadata.ReleaseMode.Mode)
	if err != nil {
		return err
	}
	if err != nil {
		return err
	}

	storybookBucket := verMode.StorybookBucket
	srcPath := verMode.StorybookSrcDir
	srcPath = filepath.Join(srcPath, deployment)

	gcs, err := storage.New()
	if err != nil {
		return err
	}
	bucket := gcs.Bucket(storybookBucket)

	if err := gcs.DeleteDir(c.Context, bucket, srcPath); err != nil {
		return err
	}

	log.Info().Msgf("Successfully cleaned source: %s/%s", storybookBucket, srcPath)

	if err := gcs.CopyLocalDir(c.Context, "packages/grafana-ui/dist/storybook", bucket, srcPath, true); err != nil {
		return err
	}

	log.Info().Msgf("Successfully stored storybook to: %s/%s!", storybookBucket, srcPath)

	return nil
}
