package main

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	
	"github.com/google/go-github/github"
	"golang.org/x/oauth2"
)

type KindRegistry struct {
	zipDir  string
	zipFile *zip.ReadCloser
}

// NewKindRegistry downloads the archive of the kind-registry GH repository and open it
func NewKindRegistry() (*KindRegistry, error) {
	ctx := context.Background()
	tc := oauth2.NewClient(ctx, nil)
	client := github.NewClient(tc)

	// Create a temporary file to store the downloaded archive
	file, err := os.CreateTemp("", "*.zip")
	if err != nil {
		return nil, fmt.Errorf("failed to create temporary file: %w", err)
	}
	defer file.Close()

	// Get the repository archive URL
	archiveURL, _, err := client.Repositories.GetArchiveLink(ctx, GITHUB_OWNER, GITHUB_REPO, github.Zipball, &github.RepositoryContentGetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get archive URL: %w", err)
	}

	// Download the archive file
	httpClient := http.DefaultClient
	resp, err := httpClient.Get(archiveURL.String())
	if err != nil {
		return nil, fmt.Errorf("failed to download archive: %w", err)
	}
	defer resp.Body.Close()

	// Save the downloaded archive to the temporary file
	_, err = io.Copy(file, resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to save archive: %w", err)
	}

	// Open the zip file for reading
	zipDir := file.Name()
	zipFile, err := zip.OpenReader(zipDir)
	if err != nil {
		return nil, fmt.Errorf("failed to open zip file %s: %w", zipDir, err)
	}

	return &KindRegistry{
		zipDir:  zipDir,
		zipFile: zipFile,
	}, nil
}

// cleanUp removes the archive from the temporary files and closes the zip reader
func (registry *KindRegistry) cleanUp() {
	if registry.zipDir != "" {
		err := os.Remove(registry.zipDir)
		if err != nil {
			fmt.Fprint(os.Stderr, fmt.Errorf("failed to remove zip archive: %w", err))
		}
	}

	if registry.zipFile != nil {
		err := registry.zipFile.Close()
		if err != nil {
			fmt.Fprint(os.Stderr, fmt.Errorf("failed to close zip file reader: %w", err))
		}
	}
}

// findLatestDir get the latest version directory published in the kind registry
func (registry *KindRegistry) findLatestDir() (string, error) {
	re := regexp.MustCompile(`([0-9]+)\.([0-9]+)\.([0-9]+)`)
	latestVersion := []uint64{0, 0, 0}
	latestDir := ""

	for _, file := range registry.zipFile.File {
		if !file.FileInfo().IsDir() {
			continue
		}

		parts := re.FindStringSubmatch(file.Name)
		if parts == nil || len(parts) < 4 {
			continue
		}

		version := make([]uint64, len(parts)-1)
		for i := 1; i < len(parts); i++ {
			version[i-1], _ = strconv.ParseUint(parts[i], 10, 32)
		}

		if isLess(latestVersion, version) {
			latestVersion = version
			latestDir = file.Name
		}
	}

	return latestDir, nil
}

// getPublishedKind retrieves the latest published kind from the kind registry
func (registry *KindRegistry) getPublishedKind(name string, category string, latestRegistryDir string) ([]byte, error) {
	if latestRegistryDir == "" {
		return nil, nil
	}

	var cueFilePath string
	switch category {
	case "core":
		cueFilePath = fmt.Sprintf("%s/%s.cue", name, name)
	case "composable":
		cueFilePath = fmt.Sprintf("%s.cue", name)
	default:
		return nil, fmt.Errorf("kind can only be core or composable")
	}

	kindPath := filepath.Join(latestRegistryDir, category, cueFilePath)
	file, err := registry.zipFile.Open(kindPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return data, nil
}
