package main

import (
	"fmt"
	"log"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/env"
	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
	"github.com/urfave/cli/v2"
)

// PublishArtifactsAction Action implements the sub-command "publish-artifacts".
func PublishArtifactsAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	security := c.Bool("security")
	var securityDestBucket, enterprise2SecurityPrefix string

	artifactsEditions, err := env.RequireListWithEnvFallback(c, "artifacts-editions", "ARTIFACTS_EDITIONS")
	if err != nil {
		return err
	}

	if security {
		securityDestBucket, err = env.RequireStringWithEnvFallback(c, "security-dest-bucket", "SECURITY_DEST_BUCKET")
		if err != nil {
			return err
		}
		enterprise2SecurityPrefix, err = env.RequireStringWithEnvFallback(c, "enterprise2-security-prefix", "ENTERPRISE2_SECURITY_PREFIX")
		if err != nil {
			return err
		}
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("error connecting to gcp, %q", err)
	}

	cfg := publishConfig{
		srcBucket:                 c.String("src-bucket"),
		destBucket:                c.String("dest-bucket"),
		enterprise2DestBucket:     c.String("enterprise2-dest-bucket"),
		enterprise2SecurityPrefix: enterprise2SecurityPrefix,
		security:                  security,
		tag:                       strings.TrimPrefix(c.String("tag"), "v"),
	}

	if cfg.security {
		cfg.destBucket = securityDestBucket
	}

	gcs, err := storage.New()
	if err != nil {
		return err
	}

	for _, edition := range artifactsEditions {
		switch edition {
		case "oss", "enterprise":
			err = copyArtifacts(c, gcs, cfg, edition)
			if err != nil {
				return err
			}
		case "enterprise2":
			err = copyEnterprise2Artifacts(c, gcs, cfg)
			if err != nil {
				return err
			}
		default:
			log.Printf("unrecognised artifacts edition: %s\n", edition)
		}
	}

	return nil
}

func copyArtifacts(c *cli.Context, gcs *storage.Client, cfg publishConfig, edition string) error {
	bucket := gcs.Bucket(cfg.destBucket)
	destURL := edition
	if !cfg.security {
		destURL = filepath.Join(destURL, "release")
	}
	log.Printf("Copying downloads for %s, from %s bucket to %s bucket", edition, cfg.srcBucket, destURL)
	if err := gcs.CopyRemoteDir(c.Context, gcs.Bucket(cfg.srcBucket), fmt.Sprintf("artifacts/downloads/v%s/%s/release", cfg.tag, edition), bucket, destURL); err != nil {
		return err
	}

	log.Printf("Successfully copied downloads.")
	return nil
}

func copyEnterprise2Artifacts(c *cli.Context, gcs *storage.Client, cfg publishConfig) error {
	bucket := gcs.Bucket(cfg.enterprise2DestBucket)
	var prefix string
	if cfg.security {
		prefix = cfg.enterprise2SecurityPrefix
	}
	destURL := fmt.Sprintf("enterprise2/%srelease", prefix)
	log.Printf("Copying downloads for enterprise2, from %s bucket to %s bucket", cfg.srcBucket, destURL)
	if err := gcs.CopyRemoteDir(c.Context, gcs.Bucket(cfg.srcBucket), fmt.Sprintf("artifacts/downloads-enterprise2/v%s/enterprise2/release", cfg.tag), bucket, destURL); err != nil {
		return err
	}
	return nil
}
