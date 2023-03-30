package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/versions"
	"github.com/urfave/cli/v2"
)

type publishConfig struct {
	tag                       string
	srcBucket                 string
	destBucket                string
	enterprise2DestBucket     string
	enterprise2SecurityPrefix string
	staticAssetsBucket        string
	staticAssetEditions       []string
	storybookBucket           string
	security                  bool
}

// requireListWithEnvFallback first checks the CLI for a flag with the required
// name. If this is empty, it  falls back to taking the environment variable.
// Sadly, we cannot use cli.Flag.EnvVars for this due to it potentially leaking
// environment variables as default values in usage-errors.
func requireListWithEnvFallback(cctx *cli.Context, name string, envName string) ([]string, error) {
	result := cctx.StringSlice(name)
	if len(result) == 0 {
		for _, v := range strings.Split(os.Getenv(envName), ",") {
			value := strings.TrimSpace(v)
			if value != "" {
				result = append(result, value)
			}
		}
	}
	if len(result) == 0 {
		return nil, cli.Exit(fmt.Sprintf("Required flag (%s) or environment variable (%s) not set", name, envName), 1)
	}
	return result, nil
}

func requireStringWithEnvFallback(cctx *cli.Context, name string, envName string) (string, error) {
	result := cctx.String(name)
	if result == "" {
		result = os.Getenv(envName)
	}
	if result == "" {
		return "", cli.Exit(fmt.Sprintf("Required flag (%s) or environment variable (%s) not set", name, envName), 1)
	}
	return result, nil
}

// Action implements the sub-command "publish-artifacts".
func PublishArtifactsAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	staticAssetEditions, err := requireListWithEnvFallback(c, "static-asset-editions", "STATIC_ASSET_EDITIONS")
	if err != nil {
		return err
	}
	securityDestBucket, err := requireStringWithEnvFallback(c, "security-dest-bucket", "SECURITY_DEST_BUCKET")
	if err != nil {
		return err
	}
	enterprise2SecurityPrefix, err := requireStringWithEnvFallback(c, "enterprise2-security-prefix", "ENTERPRISE2_SECURITY_PREFIX")
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
		staticAssetsBucket:        c.String("static-assets-bucket"),
		staticAssetEditions:       staticAssetEditions,
		storybookBucket:           c.String("storybook-bucket"),
		security:                  c.Bool("security"),
		tag:                       strings.TrimPrefix(c.String("tag"), "v"),
	}

	if cfg.security {
		cfg.destBucket = securityDestBucket
	}

	err = copyStaticAssets(cfg)
	if err != nil {
		return err
	}
	err = copyStorybook(cfg)
	if err != nil {
		return err
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

func copyStaticAssets(cfg publishConfig) error {
	for _, edition := range cfg.staticAssetEditions {
		log.Printf("Copying static assets for %s", edition)
		srcURL := fmt.Sprintf("%s/artifacts/static-assets/%s/%s/*", cfg.srcBucket, edition, cfg.tag)
		destURL := fmt.Sprintf("%s/%s/%s/", cfg.staticAssetsBucket, edition, cfg.tag)
		err := gcsCopy("static assets", srcURL, destURL)
		if err != nil {
			return fmt.Errorf("error copying static assets, %q", err)
		}
	}
	log.Printf("Successfully copied static assets!")
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
	err := gcsCopy("storybook", srcURL, destURL)
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
		err := gcsCopy("storybook (latest)", srcURL, destURL)
		if err != nil {
			return fmt.Errorf("error copying storybook to latest. %q", err)
		}
	}

	log.Printf("Successfully copied storybook!")
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
		err := gcsCopy("downloads", srcURL, destURL)
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
	err := gcsCopy("enterprise2 downloads", srcURL, destURL)
	if err != nil {
		return fmt.Errorf("error copying ")
	}
	return nil
}

func gcsCopy(desc, src, dest string) error {
	args := strings.Split(fmt.Sprintf("-m cp -r gs://%s gs://%s", src, dest), " ")
	// nolint:gosec
	cmd := exec.Command("gsutil", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to publish %s: %w\n%s", desc, err, out)
	}
	return nil
}
