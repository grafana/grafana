package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/droneutil"
	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/packaging"
)

const releaseFolder = "release"
const mainFolder = "main"
const releaseBranchFolder = "prerelease"

type uploadConfig struct {
	config.Config

	edition       config.Edition
	versionMode   config.VersionMode
	gcpKey        string
	distDir       string
	versionFolder string
}

// UploadPackages implements the sub-command "upload-packages".
func UploadPackages(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	gcpKeyB64 := strings.TrimSpace(os.Getenv("GCP_KEY"))
	if gcpKeyB64 == "" {
		return cli.Exit("the environment variable GCP_KEY must be set", 1)
	}
	gcpKeyB, err := base64.StdEncoding.DecodeString(gcpKeyB64)
	if err != nil {
		return cli.Exit("failed to base64 decode $GCP_KEY", 1)
	}
	gcpKey := string(gcpKeyB)

	distDir, err := filepath.Abs("dist")
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	version := metadata.GrafanaVersion

	releaseMode, err := metadata.GetReleaseMode()
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	releaseModeConfig, err := config.GetBuildConfig(releaseMode.Mode)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	var edition config.Edition
	if e, ok := os.LookupEnv("EDITION"); ok {
		edition = config.Edition(e)
	}

	if c.Bool("enterprise2") {
		edition = config.EditionEnterprise2
	}

	if edition == "" {
		return fmt.Errorf("both EDITION envvar and '--enterprise2' flag are missing. At least one of those is required")
	}

	// TODO: Verify config values
	cfg := uploadConfig{
		Config: config.Config{
			Version: version,
			Bucket:  releaseModeConfig.Buckets.Artifacts,
		},
		edition:     edition,
		versionMode: releaseMode.Mode,
		gcpKey:      gcpKey,
		distDir:     distDir,
	}

	event, err := droneutil.GetDroneEventFromEnv()
	if err != nil {
		return err
	}

	if cfg.edition == config.EditionEnterprise2 {
		cfg.Bucket, err = bucketForEnterprise2(releaseModeConfig, event)
		if err != nil {
			return err
		}
	}

	cfg.versionFolder, err = getVersionFolder(cfg, event)
	if err != nil {
		return err
	}

	if err := uploadPackages(cfg); err != nil {
		return cli.Exit(err.Error(), 1)
	}

	log.Println("Successfully uploaded packages!")
	return nil
}

// Corner case for custom enterprise2 mode
func bucketForEnterprise2(releaseModeConfig *config.BuildConfig, event string) (string, error) {
	if event == config.Custom {
		buildConfig, err := config.GetBuildConfig(config.ReleaseBranchMode)
		if err != nil {
			return "", err
		}
		return buildConfig.Buckets.ArtifactsEnterprise2, nil
	}

	if releaseModeConfig.Buckets.ArtifactsEnterprise2 != "" {
		return releaseModeConfig.Buckets.ArtifactsEnterprise2, nil
	}

	return "", fmt.Errorf("enterprise2 bucket var doesn't exist")
}

func getVersionFolder(cfg uploadConfig, event string) (string, error) {
	switch cfg.versionMode {
	case config.TagMode:
		return releaseFolder, nil
	case config.MainMode, config.DownstreamMode:
		return mainFolder, nil
	case config.ReleaseBranchMode:
		return releaseBranchFolder, nil
	default:
		// Corner case for custom enterprise2 mode
		if event == config.Custom && cfg.versionMode == config.Enterprise2Mode {
			return releaseFolder, nil
		}
		return "", fmt.Errorf("unrecognized version mode: %s", cfg.versionMode)
	}
}

func uploadPackages(cfg uploadConfig) error {
	log.Printf("Uploading Grafana packages, version %s, %s edition, %s mode...\n", cfg.Version, cfg.edition,
		cfg.versionMode)

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("couldn't activate service account, err: %w", err)
	}

	edition := strings.ToLower(string(cfg.edition))

	var sfx string
	switch cfg.edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = "-enterprise"
	case config.EditionEnterprise2:
		sfx = "-enterprise2"
	default:
		panic(fmt.Sprintf("unrecognized edition %q", cfg.edition))
	}
	matches, err := filepath.Glob(filepath.Join(cfg.distDir, fmt.Sprintf("grafana%s*", sfx)))
	if err != nil {
		return fmt.Errorf("failed to list packages: %w", err)
	}
	fpaths := []string{}
	rePkg := packaging.PackageRegexp(cfg.edition)
	for _, fpath := range matches {
		fname := filepath.Base(fpath)
		if strings.Contains(fname, "latest") || !rePkg.MatchString(fname) {
			log.Printf("Ignoring file %q\n", fpath)
			continue
		}

		fpaths = append(fpaths, fpath)
	}

	var tag, gcsPath string
	droneTag := strings.TrimSpace(os.Getenv("DRONE_TAG"))
	if droneTag != "" {
		tag = droneTag
		gcsPath = fmt.Sprintf("gs://%s/%s/%s/%s", cfg.Bucket, tag, edition, cfg.versionFolder)
	} else {
		gcsPath = fmt.Sprintf("gs://%s/%s/%s/", cfg.Bucket, edition, cfg.versionFolder)
	}
	log.Printf("Uploading %d file(s) to GCS (%s)...\n", len(fpaths), gcsPath)

	args := []string{"-m", "cp"}
	args = append(args, fpaths...)
	args = append(args, gcsPath)
	cmd := exec.Command("gsutil", args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to upload files to GCS: %s", output)
	}

	return nil
}
