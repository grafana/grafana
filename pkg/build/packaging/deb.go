package packaging

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/fsutil"
	"github.com/grafana/grafana/pkg/infra/fs"
)

func writeAptlyConf(dbDir, repoDir string) error {
	aptlyConf := fmt.Sprintf(`{
  "rootDir": "%s",
  "downloadConcurrency": 4,
  "downloadSpeedLimit": 0,
  "architectures": [],
  "dependencyFollowSuggests": false,
  "dependencyFollowRecommends": false,
  "dependencyFollowAllVariants": false,
  "dependencyFollowSource": false,
  "dependencyVerboseResolve": false,
  "gpgDisableSign": false,
  "gpgDisableVerify": false,
  "gpgProvider": "gpg2",
  "downloadSourcePackages": false,
  "skipLegacyPool": true,
  "ppaDistributorID": "ubuntu",
  "ppaCodename": "",
  "skipContentsPublishing": false,
  "FileSystemPublishEndpoints": {
    "repo": {
      "rootDir": "%s",
      "linkMethod": "copy"
    }
  },
  "S3PublishEndpoints": {},
  "SwiftPublishEndpoints": {}
}
`, dbDir, repoDir)
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(home, ".aptly.conf"), []byte(aptlyConf), 0600)
}

// downloadDebs downloads Deb packages.
func downloadDebs(cfg PublishConfig, workDir string) error {
	if cfg.Bucket == "" {
		panic("cfg.Bucket has to be set")
	}
	if !strings.HasSuffix(workDir, string(filepath.Separator)) {
		workDir += string(filepath.Separator)
	}

	var version string
	if cfg.ReleaseMode.Mode == config.TagMode {
		if cfg.ReleaseMode.IsBeta {
			version = strings.ReplaceAll(cfg.Version, "-", "~")
		} else {
			version = cfg.Version
		}
	}
	if version == "" {
		panic(fmt.Sprintf("Unrecognized version mode %s", cfg.ReleaseMode.Mode))
	}

	var sfx string
	switch cfg.Edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = EnterpriseSfx
	default:
		return fmt.Errorf("unrecognized edition %q", cfg.Edition)
	}

	u := fmt.Sprintf("gs://%s/%s/%s/grafana%s_%s_*.deb*", cfg.Bucket,
		strings.ToLower(string(cfg.Edition)), ReleaseFolder, sfx, version)
	log.Printf("Downloading Deb packages %q...\n", u)
	args := []string{
		"-m",
		"cp",
		u,
		workDir,
	}
	//nolint:gosec
	cmd := exec.Command("gsutil", args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to download Deb packages %q: %w\n%s", u, err, output)
	}

	return nil
}

// UpdateDebRepo updates the Debian repository with the new release.
func UpdateDebRepo(cfg PublishConfig, workDir string) error {
	if cfg.ReleaseMode.Mode != config.TagMode {
		panic(fmt.Sprintf("Unsupported version mode: %s", cfg.ReleaseMode.Mode))
	}

	if cfg.ReleaseMode.IsTest {
		if cfg.Config.DebDBBucket == DefaultDebDBBucket {
			return fmt.Errorf("in test-release mode, the default Deb DB bucket shouldn't be used")
		}
		if cfg.Config.DebRepoBucket == DefaultDebRepoBucket {
			return fmt.Errorf("in test-release mode, the default Deb repo bucket shouldn't be used")
		}
	}

	if err := downloadDebs(cfg, workDir); err != nil {
		return err
	}

	repoName := "grafana"
	if cfg.ReleaseMode.IsBeta {
		repoName = "beta"
	}

	repoRoot, err := fsutil.CreateTempDir("deb-repo")
	if err != nil {
		return err
	}
	defer func() {
		if err := os.RemoveAll(repoRoot); err != nil {
			log.Printf("Failed to remove temporary directory %q: %s\n", repoRoot, err.Error())
		}
	}()

	dbDir := filepath.Join(repoRoot, "db")
	repoDir := filepath.Join(repoRoot, "repo")
	tmpDir := filepath.Join(repoRoot, "tmp")
	for _, dpath := range []string{dbDir, repoDir, tmpDir} {
		if err := os.MkdirAll(dpath, 0750); err != nil {
			return err
		}
	}

	if err := writeAptlyConf(dbDir, repoDir); err != nil {
		return err
	}

	// Download the Debian repo database
	u := fmt.Sprintf("gs://%s/%s", cfg.DebDBBucket, strings.ToLower(string(cfg.Edition)))
	log.Printf("Downloading Debian repo database from %s...\n", u)
	//nolint:gosec
	cmd := exec.Command("gsutil", "-m", "rsync", "-r", "-d", u, dbDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to download Debian repo database: %w\n%s", err, output)
	}

	if err := addPkgsToRepo(cfg, workDir, tmpDir, repoName); err != nil {
		return err
	}

	log.Println("Updating local Debian package repository...")
	// Update published local repository. This assumes that there exists already a local, published repo.
	for _, tp := range []string{"stable", "beta"} {
		passArg := fmt.Sprintf("-passphrase-file=%s", cfg.GPGPassPath)
		//nolint:gosec
		cmd := exec.Command("aptly", "publish", "update", "-batch", passArg, "-force-overwrite", tp,
			"filesystem:repo:grafana")
		if output, err := cmd.CombinedOutput(); err != nil {
			return cli.Exit(fmt.Sprintf("failed to update Debian %q repository: %s", tp, output), 1)
		}
	}

	// Update database in GCS
	u = fmt.Sprintf("gs://%s/%s", cfg.DebDBBucket, strings.ToLower(string(cfg.Edition)))
	if cfg.DryRun {
		log.Printf("Simulating upload of Debian repo database to GCS (%s)\n", u)
	} else {
		log.Printf("Uploading Debian repo database to GCS (%s)...\n", u)
		//nolint:gosec
		cmd = exec.Command("gsutil", "-m", "rsync", "-r", "-d", dbDir, u)
		if output, err := cmd.CombinedOutput(); err != nil {
			return cli.Exit(fmt.Sprintf("failed to upload Debian repo database to GCS: %s", output), 1)
		}
	}

	// Update metadata and binaries in repository bucket
	u = fmt.Sprintf("gs://%s/%s/deb", cfg.DebRepoBucket, strings.ToLower(string(cfg.Edition)))
	grafDir := filepath.Join(repoDir, "grafana")
	if cfg.DryRun {
		log.Printf("Simulating upload of Debian repo resources to GCS (%s)\n", u)
	} else {
		log.Printf("Uploading Debian repo resources to GCS (%s)...\n", u)
		//nolint:gosec
		cmd = exec.Command("gsutil", "-m", "rsync", "-r", "-d", grafDir, u)
		if output, err := cmd.CombinedOutput(); err != nil {
			return cli.Exit(fmt.Sprintf("failed to upload Debian repo resources to GCS: %s", output), 1)
		}
		allRepoResources := fmt.Sprintf("%s/**/*", u)
		log.Printf("Setting cache ttl for Debian repo resources on GCS (%s)...\n", allRepoResources)
		//nolint:gosec
		cmd = exec.Command("gsutil", "-m", "setmeta", "-h", CacheSettings+cfg.TTL, allRepoResources)
		if output, err := cmd.CombinedOutput(); err != nil {
			return cli.Exit(fmt.Sprintf("failed to set cache ttl for Debian repo resources on GCS: %s", output), 1)
		}
	}

	return nil
}

func addPkgsToRepo(cfg PublishConfig, workDir, tmpDir, repoName string) error {
	var sfx string
	switch cfg.Edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = EnterpriseSfx
	default:
		return fmt.Errorf("unsupported edition %q", cfg.Edition)
	}

	log.Printf("Adding packages to Debian %q repo...\n", repoName)
	// TODO: Be more specific about filename pattern
	debs, err := filepath.Glob(filepath.Join(workDir, fmt.Sprintf("grafana%s*.deb", sfx)))
	if err != nil {
		return err
	}
	for _, deb := range debs {
		basename := filepath.Base(deb)
		if strings.Contains(basename, "latest") {
			continue
		}

		tgt := filepath.Join(tmpDir, basename)
		if err := fs.CopyFile(deb, tgt); err != nil {
			return err
		}
	}
	// XXX: Adds too many packages in enterprise (Arve: What does this mean exactly?)
	//nolint:gosec
	cmd := exec.Command("aptly", "repo", "add", "-force-replace", repoName, tmpDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		return cli.Exit(fmt.Sprintf("failed to add packages to local Debian repository: %s", output), 1)
	}

	return nil
}
