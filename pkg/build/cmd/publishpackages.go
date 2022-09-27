package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gcloud"
	"github.com/grafana/grafana/pkg/build/gpg"
	"github.com/rs/zerolog/log"
	"github.com/urfave/cli/v2"
)

// PublishPackages implements the sub-command "publish-packages".
func PublishPackages(c *cli.Context) error {
	if c.NArg() > 1 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.NewExitError(err.Error(), 1)
		}
		return cli.NewExitError("", 1)
	}

	if err := gcloud.ActivateServiceAccount(); err != nil {
		return fmt.Errorf("couldn't activate service account, err: %w", err)
	}

	metadata, err := GenerateMetadata(c)
	if err != nil {
		return err
	}

	releaseMode, err := metadata.GetReleaseMode()
	if err != nil {
		return err
	}

	dryRun := c.Bool("dry-run")
	simulateRelease := c.Bool("simulate-release")
	// Test release mode and dryRun imply simulateRelease
	if releaseMode.IsTest || dryRun {
		simulateRelease = true
	}

	grafanaAPIKey := strings.TrimSpace(os.Getenv("GRAFANA_COM_API_KEY"))
	if grafanaAPIKey == "" {
		return cli.NewExitError("the environment variable GRAFANA_COM_API_KEY must be set", 1)
	}

	edition := config.Edition(c.String("edition"))

	// TODO: Verify config values
	cfg := PublishConfig{
		Config: config.Config{
			Version:       metadata.GrafanaVersion,
			Bucket:        c.String("packages-bucket"),
			DebDBBucket:   c.String("deb-db-bucket"),
			DebRepoBucket: c.String("deb-repo-bucket"),
			RPMRepoBucket: c.String("rpm-repo-bucket"),
		},
		Edition:         edition,
		ReleaseMode:     releaseMode,
		GrafanaAPIKey:   grafanaAPIKey,
		DryRun:          dryRun,
		TTL:             c.String("ttl"),
		SimulateRelease: simulateRelease,
	}
	if err := gpg.LoadGPGKeys(&cfg.Config); err != nil {
		return err
	}
	defer gpg.RemoveGPGFiles(cfg.Config)

	// Only update package manager repos for releases.
	// In test release mode, the operator should configure different GCS buckets for the package repos,
	// so should be safe.
	if cfg.ReleaseMode.Mode == config.TagMode {
		workDir, err := ioutil.TempDir("", "")
		if err != nil {
			return cli.NewExitError(fmt.Errorf("failed to make temporary directory: %w", err), 1)
		}
		defer func() {
			if err := os.RemoveAll(workDir); err != nil {
				log.Warn().Msgf("Failed to remove temporary directory %q: %s", workDir, err.Error())
			}
		}()
		if err := updatePkgRepos(cfg, workDir); err != nil {
			return err
		}
	}

	log.Info().Msg("Successfully published packages!")
	return nil
}

// updatePkgRepos updates package manager repositories.
func updatePkgRepos(cfg PublishConfig, workDir string) error {
	if err := gpg.Import(cfg.Config); err != nil {
		return err
	}

	// If updating the Deb repo fails, still continue with the RPM repo, so we don't have to retry
	// both by hand
	debErr := updateDebRepo(cfg, workDir)
	if debErr != nil {
		log.Error().Msgf("Updating Deb repo failed: %s", debErr)
	}
	rpmErr := updateRPMRepo(cfg, workDir)
	if rpmErr != nil {
		log.Error().Msgf("Updating RPM repo failed: %s", rpmErr)
	}

	if debErr != nil {
		return debErr
	}
	if rpmErr != nil {
		return rpmErr
	}

	log.Info().Msg("Updated Deb and RPM repos successfully!")

	return nil
}
