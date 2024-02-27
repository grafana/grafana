package main

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"cuelang.org/go/cue"
	cueformat "cuelang.org/go/cue/format"
	"github.com/google/go-github/github"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/registry/schemas"
	"golang.org/x/oauth2"
)

const (
	GITHUB_OWNER = "grafana"
	GITHUB_REPO  = "kind-registry"
)

// main This script verifies that stable kinds are not updated once published (new schemas
// can be added but existing ones cannot be updated).
// If the env variable CODEGEN_VERIFY is not present, this also generates kind files into a
// local "next" folder, ready to be published in the kind-registry repo.
// If kind names are given as parameters, the script will make the above actions only for the
// given kinds.
func main() {

	kindRegistry, err := NewKindRegistry()
	defer kindRegistry.cleanUp()
	if err != nil {
		die(err)
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		os.Exit(0)
	}

	// File generation
	jfs := codejen.NewFS()
	outputPath := filepath.Join(".github", "workflows", "scripts", "kinds")

	corekinds, err := schemas.GetCoreKinds()
	if err != nil {
		die(err)
	}

	coreJennies := codejen.JennyList[schemas.CoreKind]{}
	coreJennies.Append(
		KindRegistryJenny(outputPath),
	)
	corefs, err := coreJennies.GenerateFS(corekinds...)
	die(err)
	die(jfs.Merge(corefs))

	composableKinds, err := schemas.GetComposableKinds()
	if err != nil {
		die(err)
	}

	composableJennies := codejen.JennyList[schemas.ComposableKind]{}
	composableJennies.Append(
		ComposableKindRegistryJenny(outputPath),
	)
	composablefs, err := composableJennies.GenerateFS(composableKinds...)
	die(err)
	die(jfs.Merge(composablefs))

	if err = jfs.Write(context.Background(), ""); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}

	if err := copyCueSchemas("packages/grafana-schema/src/common", filepath.Join(outputPath, "next")); err != nil {
		die(fmt.Errorf("error while copying the grafana-schema/common package:\n%s", err))
	}
}

func copyCueSchemas(fromDir string, toDir string) error {
	baseTargetDir := filepath.Base(fromDir)

	return filepath.Walk(fromDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		targetPath := filepath.Join(
			toDir,
			baseTargetDir,
			strings.TrimPrefix(path, fromDir),
		)

		if info.IsDir() {
			return ensureDirectoryExists(targetPath, info.Mode())
		}

		if !strings.HasSuffix(path, ".cue") {
			return nil
		}

		return copyFile(path, targetPath, info.Mode())
	})
}

func copyFile(from string, to string, mode os.FileMode) error {
	input, err := os.ReadFile(from)
	if err != nil {
		return err
	}

	return os.WriteFile(to, input, mode)
}

func ensureDirectoryExists(directory string, mode os.FileMode) error {
	_, err := os.Stat(directory)
	if errors.Is(err, os.ErrNotExist) {
		if err = os.Mkdir(directory, mode); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}

	return os.Chmod(directory, mode)
}

func die(errs ...error) {
	if len(errs) > 0 && errs[0] != nil {
		for _, err := range errs {
			fmt.Fprint(os.Stderr, err, "\n")
		}
		os.Exit(1)
	}
}

func isLess(v1 []uint64, v2 []uint64) bool {
	if len(v1) == 1 || len(v2) == 1 {
		return v1[0] < v2[0]
	}

	return v1[0] < v2[0] || (v1[0] == v2[0] && isLess(v1[2:], v2[2:]))
}

// KindRegistryJenny generates kind files into the "next" folder of the local kind registry.
func KindRegistryJenny(path string) codejen.OneToOne[schemas.CoreKind] {
	return &kindregjenny{
		path: path,
	}
}

type kindregjenny struct {
	path string
}

func (j *kindregjenny) JennyName() string {
	return "KindRegistryJenny"
}

func (j *kindregjenny) Generate(kind schemas.CoreKind) (*codejen.File, error) {
	newKindBytes, err := kindToBytes(kind.CueFile)
	if err != nil {
		return nil, err
	}

	path := filepath.Join(j.path, "next", "core", kind.Name, kind.Name+".cue")
	return codejen.NewFile(path, newKindBytes, j), nil
}

// kindToBytes converts a kind cue value to a .cue file content
func kindToBytes(kind cue.Value) ([]byte, error) {
	node := kind.Syntax(
		cue.All(),
		cue.Schema(),
		cue.Docs(true),
	)

	return cueformat.Node(node)
}

// ComposableKindRegistryJenny generates kind files into the "next" folder of the local kind registry.
func ComposableKindRegistryJenny(path string) codejen.OneToOne[schemas.ComposableKind] {
	return &ckrJenny{
		path: path,
	}
}

type ckrJenny struct {
	path string
}

func (j *ckrJenny) JennyName() string {
	return "ComposableKindRegistryJenny"
}

func (j *ckrJenny) Generate(k schemas.ComposableKind) (*codejen.File, error) {

	name := strings.ToLower(fmt.Sprintf("%s/%s", k.Name, k.Filename))

	newKindBytes, err := kindToBytes(k.CueFile)
	if err != nil {
		return nil, err
	}

	newKindBytes = []byte(fmt.Sprintf("package grafanaplugin\n\n%s", newKindBytes))

	return codejen.NewFile(filepath.Join(j.path, "next", "composable", name+".cue"), newKindBytes, j), nil
}

type kindRegistry struct {
	zipDir  string
	zipFile *zip.ReadCloser
}

// NewKindRegistry downloads the archive of the kind-registry GH repository and open it
func NewKindRegistry() (*kindRegistry, error) {
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

	return &kindRegistry{
		zipDir:  zipDir,
		zipFile: zipFile,
	}, nil
}

// cleanUp removes the archive from the temporary files and closes the zip reader
func (registry *kindRegistry) cleanUp() {
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
func (registry *kindRegistry) findLatestDir() (string, error) {
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
func (registry *kindRegistry) getPublishedKind(name string, category string, latestRegistryDir string) ([]byte, error) {
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

func isLessMaturity(old, new string) bool {
	var order = []string{
		"merged",
		"experimental",
		"stable",
		"mature",
	}

	oldOrder := 0
	for i, oldMaturity := range order {
		if oldMaturity == old {
			oldOrder = i
		}
	}

	newOrder := 0
	for i, newMaturity := range order {
		if newMaturity == new {
			newOrder = i
		}
	}

	return newOrder < oldOrder
}
