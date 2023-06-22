package npm

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/gcloud/storage"
	"github.com/grafana/grafana/pkg/build/lerna"
	"github.com/grafana/grafana/pkg/build/versions"
)

const GrafanaDir = "."
const NpmArtifactDir = "./npm-artifacts"

// TODO: could this be replaced by `yarn lerna list -p` ?
var packages = []string{
	"@grafana/ui",
	"@grafana/data",
	"@grafana/toolkit",
	"@grafana/runtime",
	"@grafana/e2e",
	"@grafana/e2e-selectors",
	"@grafana/schema",
}

// PublishNpmPackages will publish local NPM packages to NPM registry.
func PublishNpmPackages(ctx context.Context, tag string) error {
	version, err := versions.GetVersion(tag)
	if err != nil {
		return err
	}

	log.Printf("Grafana version: %s", version.Version)

	if err := setNpmCredentials(); err != nil {
		return err
	}

	npmArtifacts, err := storage.ListLocalFiles(NpmArtifactDir)
	if err != nil {
		return err
	}
	for _, packedFile := range npmArtifacts {
		// nolint:gosec
		cmd := exec.CommandContext(ctx, "npm", "publish", packedFile.FullPath, "--tag", version.Channel)
		cmd.Dir = GrafanaDir
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("command '%s' failed to run, output: %s, err: %q", cmd.String(), out, err)
		}
	}

	return updateTag(ctx, version, tag)
}

// StoreNpmPackages will store local NPM packages in GCS bucket `bucketName`.
func StoreNpmPackages(ctx context.Context, tag, bucketName string) error {
	err := lerna.PackFrontendPackages(ctx, tag, GrafanaDir, NpmArtifactDir)
	if err != nil {
		return err
	}

	gcs, err := storage.New()
	if err != nil {
		return err
	}

	bucket := gcs.Bucket(bucketName)
	bucketPath := fmt.Sprintf("artifacts/npm/%s/", tag)
	if err = gcs.CopyLocalDir(ctx, NpmArtifactDir, bucket, bucketPath, true); err != nil {
		return err
	}

	log.Print("Successfully stored npm packages!")
	return nil
}

// FetchNpmPackages will store NPM packages stored in GCS bucket `bucketName` on local disk in `frontend.NpmArtifactDir`.
func FetchNpmPackages(ctx context.Context, tag, bucketName string) error {
	gcs, err := storage.New()
	if err != nil {
		return err
	}

	bucketPath := fmt.Sprintf("artifacts/npm/%s/", tag)
	bucket := gcs.Bucket(bucketName)
	err = gcs.DownloadDirectory(ctx, bucket, NpmArtifactDir, storage.FilesFilter{
		Prefix:   bucketPath,
		FileExts: []string{".tgz"},
	})
	if err != nil {
		return err
	}
	return nil
}

// updateTag will move next or latest npm dist-tags, if needed.
//
// Note: This function makes the assumption that npm dist-tags has already
// been updated and hence why move of dist-tags not always happens:
//
//	If stable the dist-tag latest was used.
//	If beta the dist-tag next was used.
//
// Scenarios:
//
//  1. Releasing a newer stable than the current stable
//     Latest and next is 9.1.5.
//     9.1.6 is released, latest and next should point to 9.1.6.
//     The next dist-tag is moved to point to 9.1.6.
//
//  2. Releasing during an active beta period:
//     Latest and next is 9.1.6.
//     9.2.0-beta1 is released, the latest should stay on 9.1.6, next should point to 9.2.0-beta1
//     No move of dist-tags
//     9.1.7 is released, the latest should point to 9.1.7, next should stay to 9.2.0-beta1
//     No move of dist-tags
//     Next week 9.2.0-beta2 is released, the latest should point to 9.1.7, next should point to 9.2.0-beta2
//     No move of dist-tags
//     In two weeks 9.2.0 stable is released, the latest and next should point to 9.2.0.
//     The next dist-tag is moved to point to 9.2.0.
//
//  3. Releasing an older stable than the current stable
//     Latest and next is 9.2.0.
//     Next 9.1.8 is released, latest should point to 9.2.0, next should point to 9.2.0
//     The latest dist-tag is moved to point to 9.2.0.
func updateTag(ctx context.Context, version *versions.Version, releaseVersion string) error {
	if version.Channel != versions.Latest {
		return nil
	}

	latestStableVersion, err := getLatestStableVersion()
	if err != nil {
		return err
	}

	betaVersion, err := getLatestBetaVersion()
	if err != nil {
		return err
	}

	isLatest, err := versions.IsGreaterThanOrEqual(releaseVersion, latestStableVersion)
	if err != nil {
		return err
	}

	isNewerThanLatestBeta, err := versions.IsGreaterThanOrEqual(releaseVersion, betaVersion)
	if err != nil {
		return err
	}

	for _, pkg := range packages {
		if !isLatest {
			err = runMoveLatestNPMTagCommand(ctx, pkg, latestStableVersion)
			if err != nil {
				return err
			}
		}

		if isLatest && isNewerThanLatestBeta {
			err = runMoveNextNPMTagCommand(ctx, pkg, version.Version)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func getLatestStableVersion() (string, error) {
	return versions.GetLatestVersion(versions.LatestStableVersionURL)
}

func getLatestBetaVersion() (string, error) {
	return versions.GetLatestVersion(versions.LatestBetaVersionURL)
}

func runMoveNextNPMTagCommand(ctx context.Context, pkg string, packageVersion string) error {
	// nolint:gosec
	cmd := exec.CommandContext(ctx, "npm", "dist-tag", "add", fmt.Sprintf("%s@%s", pkg, packageVersion), "next")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("command '%s' failed to run, output: %s, err: %q", cmd.String(), out, err)
	}

	return nil
}

func runMoveLatestNPMTagCommand(ctx context.Context, pkg string, latestStableVersion string) error {
	// nolint:gosec
	cmd := exec.CommandContext(ctx, "npm", "dist-tag", "add", fmt.Sprintf("%s@%s", pkg, latestStableVersion), "latest")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("command '%s' failed to run, output: %s, err: %q", cmd.String(), out, err)
	}

	return nil
}

// setNpmCredentials Creates a .npmrc file in the users home folder and writes the
// necessary credentials to it for publishing packages to the NPM registry.
func setNpmCredentials() error {
	npmToken := strings.TrimSpace(os.Getenv("NPM_TOKEN"))
	if npmToken == "" {
		return fmt.Errorf("npm token is not set")
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to obtain home directory, err: %q", err)
	}

	npmPath := filepath.Join(homeDir, ".npmrc")
	registry := []byte(fmt.Sprintf("//registry.npmjs.org/:_authToken=%s", npmToken))
	if _, err = os.Stat(npmPath); os.IsNotExist(err) {
		// nolint:gosec
		f, err := os.Create(npmPath)
		if err != nil {
			return fmt.Errorf("couldn't create npmrc file, err: %q", err)
		}
		_, err = f.Write(registry)
		if err != nil {
			return fmt.Errorf("failed to write to file, err: %q", err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				log.Printf("Failed to close file: %s", err.Error())
			}
		}()
	} else {
		err = os.WriteFile(npmPath, registry, 0644)
		if err != nil {
			return fmt.Errorf("error writing to file, err: %q", err)
		}
	}
	return nil
}
