package docker

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
)

// verifyArchive verifies the integrity of an archive file.
func verifyArchive(archive string) error {
	log.Printf("Verifying checksum of %q", archive)

	//nolint:gosec
	shaB, err := os.ReadFile(archive + ".sha256")
	if err != nil {
		return err
	}

	exp := strings.TrimSpace(string(shaB))

	//nolint:gosec
	f, err := os.Open(archive)
	if err != nil {
		return err
	}

	defer func() {
		if err := f.Close(); err != nil {
			log.Println("error closing file:", err)
		}
	}()

	h := sha256.New()
	_, err = io.Copy(h, f)
	if err != nil {
		return err
	}

	chksum := hex.EncodeToString(h.Sum(nil))
	if chksum != exp {
		return fmt.Errorf("archive checksum is different than expected: %q", archive)
	}

	log.Printf("Archive %q has expected checksum: %s", archive, exp)

	return nil
}

// BuildImage builds a Docker image.
// The image tag is returned.
func BuildImage(version string, arch config.Architecture, grafanaDir string, useUbuntu, shouldSave bool, edition config.Edition, mode config.VersionMode) ([]string, error) {
	var baseArch string

	switch arch {
	case "amd64":
	case "armv7":
		baseArch = "arm32v7/"
	case "arm64":
		baseArch = "arm64v8/"
	default:
		return []string{}, fmt.Errorf("unrecognized architecture %q", arch)
	}

	libc := "-musl"
	baseImage := fmt.Sprintf("%salpine:3.17", baseArch)
	tagSuffix := ""
	if useUbuntu {
		libc = ""
		baseImage = fmt.Sprintf("%subuntu:20.04", baseArch)
		tagSuffix = "-ubuntu"
	}

	var editionStr string
	var dockerRepo string
	var additionalDockerRepo string
	var tags []string
	var imageFileBase string
	var dockerEnterprise2Repo string
	if repo, ok := os.LookupEnv("DOCKER_ENTERPRISE2_REPO"); ok {
		dockerEnterprise2Repo = repo
	}

	switch edition {
	case config.EditionOSS:
		dockerRepo = "grafana/grafana-image-tags"
		additionalDockerRepo = "grafana/grafana-oss-image-tags"
		imageFileBase = "grafana-oss"
	case config.EditionEnterprise:
		dockerRepo = "grafana/grafana-enterprise-image-tags"
		imageFileBase = "grafana-enterprise"
		editionStr = "-enterprise"
	case config.EditionEnterprise2:
		dockerRepo = dockerEnterprise2Repo
		imageFileBase = "grafana-enterprise2"
		editionStr = "-enterprise2"
	default:
		return []string{}, fmt.Errorf("unrecognized edition %s", edition)
	}

	buildDir := filepath.Join(grafanaDir, "packaging/docker")
	// For example: grafana-8.5.0-52819pre.linux-amd64-musl.tar.gz
	archive := fmt.Sprintf("grafana%s-%s.linux-%s%s.tar.gz", editionStr, version, arch, libc)
	if err := verifyArchive(filepath.Join(buildDir, archive)); err != nil {
		return []string{}, err
	}

	tag := fmt.Sprintf("%s:%s%s-%s", dockerRepo, version, tagSuffix, arch)
	tags = append(tags, tag)

	args := []string{
		"build",
		"-q",
		"--build-arg", fmt.Sprintf("BASE_IMAGE=%s", baseImage),
		"--build-arg", fmt.Sprintf("GRAFANA_TGZ=%s", archive),
		"--build-arg", "GO_SRC=tgz-builder",
		"--build-arg", "JS_SRC=tgz-builder",
		"--build-arg", "RUN_SH=./run.sh",
		"--tag", tag,
		"--no-cache",
		"--file", "../../Dockerfile",
		".",
		"--label", fmt.Sprintf("mode=%s", string(mode)),
	}

	//nolint:gosec
	cmd := exec.Command("docker", args...)
	cmd.Dir = buildDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), "DOCKER_CLI_EXPERIMENTAL=enabled", "DOCKER_BUILDKIT=1")
	log.Printf("Running Docker: DOCKER_CLI_EXPERIMENTAL=enabled DOCKER_BUILDKIT=1 %s", cmd)
	if err := cmd.Run(); err != nil {
		return []string{}, fmt.Errorf("building Docker image failed: %w", err)
	}
	if shouldSave {
		imageFile := fmt.Sprintf("%s-%s%s-%s.img", imageFileBase, version, tagSuffix, arch)
		//nolint:gosec
		cmd = exec.Command("docker", "save", tag, "-o", imageFile)
		cmd.Dir = buildDir
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		log.Printf("Running Docker: %s", cmd)
		if err := cmd.Run(); err != nil {
			return []string{}, fmt.Errorf("saving Docker image failed: %w", err)
		}
		gcsURL := fmt.Sprintf("gs://grafana-prerelease/artifacts/docker/%s/%s", version, imageFile)
		//nolint:gosec
		cmd = exec.Command("gsutil", "-q", "cp", imageFile, gcsURL)
		cmd.Dir = buildDir
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		log.Printf("Running gsutil: %s", cmd)
		if err := cmd.Run(); err != nil {
			return []string{}, fmt.Errorf("storing Docker image failed: %w", err)
		}
		log.Printf("Docker image %s stored to grafana-prerelease GCS bucket", imageFile)
	}
	if additionalDockerRepo != "" {
		additionalTag := fmt.Sprintf("%s:%s%s-%s", additionalDockerRepo, version, tagSuffix, arch)

		//nolint:gosec
		cmd = exec.Command("docker", "tag", tag, additionalTag)
		cmd.Dir = buildDir
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		log.Printf("Running Docker: %s", cmd)
		if err := cmd.Run(); err != nil {
			return []string{}, fmt.Errorf("tagging Docker image failed: %w", err)
		}
		tags = append(tags, additionalTag)
	}

	return tags, nil
}
