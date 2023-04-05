package main

import (
	"fmt"
	"github.com/grafana/grafana/pkg/build/env"
	"github.com/grafana/grafana/pkg/build/gcloud/storage"
	"log"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/gcloud"
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

	securityDestBucket, err := env.RequireStringWithEnvFallback(c, "security-dest-bucket", "SECURITY_DEST_BUCKET")
	if err != nil {
		return err
	}
	enterprise2SecurityPrefix, err := env.RequireStringWithEnvFallback(c, "enterprise2-security-prefix", "ENTERPRISE2_SECURITY_PREFIX")
	if err != nil {
		return err
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("error connecting to gcp, %q", err)
	}

	cfg := publishConfig{
		srcBucket:                 c.String("src-bucket"),
		destBucket:                c.String("dest-bucket"),
		enterprise2DestBucket:     c.String("enterprise2-dest-bucket"),
		enterprise2SecurityPrefix: enterprise2SecurityPrefix,
		security:                  c.Bool("security"),
		tag:                       strings.TrimPrefix(c.String("tag"), "v"),
	}

	if cfg.security {
		cfg.destBucket = securityDestBucket
	}

	err = copyDownloads(cfg)
	if err != nil {
		return err
	}
	err = copyEnterprise2Downloads(cfg)
	if err != nil {
		return err
	}
	return nil
}

func copyDownloads(cfg publishConfig) error {
	for _, edition := range []string{
		"oss", "enterprise",
	} {
		destURL := fmt.Sprintf("%s/%s/", cfg.destBucket, edition)
		srcURL := fmt.Sprintf("%s/artifacts/downloads/v%s/%s/release/*", cfg.srcBucket, cfg.tag, edition)
		if !cfg.security {
			destURL = filepath.Join(destURL, "release")
		}
		log.Printf("Copying downloads for %s, from %s bucket to %s bucket", edition, srcURL, destURL)
		err := storage.GCSCopy("downloads", srcURL, destURL)
		if err != nil {
			return fmt.Errorf("error copying downloads, %q", err)
		}
	}
	log.Printf("Successfully copied downloads.")
	return nil
}

func copyEnterprise2Downloads(cfg publishConfig) error {
	var prefix string
	if cfg.security {
		prefix = cfg.enterprise2SecurityPrefix
	}
	srcURL := fmt.Sprintf("%s/artifacts/downloads-enterprise2/v%s/enterprise2/release/*", cfg.srcBucket, cfg.tag)
	destURL := fmt.Sprintf("%s/enterprise2/%srelease", cfg.enterprise2DestBucket, prefix)
	log.Printf("Copying downloads for enterprise2, from %s bucket to %s bucket", srcURL, destURL)
	err := storage.GCSCopy("enterprise2 downloads", srcURL, destURL)
	if err != nil {
		return fmt.Errorf("error copying ")
	}
	return nil
}
