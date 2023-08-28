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
	"strings"
	"testing/fstest"

	"cuelang.org/go/cue"
	cueformat "cuelang.org/go/cue/format"
	"github.com/google/go-github/github"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
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
	var corek []kindsys.Kind
	var compok []kindsys.Composable

	kindRegistry, err := NewKindRegistry()
	defer kindRegistry.cleanUp()
	if err != nil {
		die(err)
	}

	// Search for the latest version directory present in the kind-registry repo
	latestRegistryDir, err := kindRegistry.findLatestDir()
	if err != nil {
		die(fmt.Errorf("failed to get latest directory for published kinds: %s", err))
	}

	errs := make([]error, 0)

	// Kind verification
	for _, kind := range corekind.NewBase(nil).All() {
		name := kind.Props().Common().MachineName
		err := verifyKind(kindRegistry, kind, name, "core", latestRegistryDir)
		if err != nil {
			errs = append(errs, err)
			continue
		}

		corek = append(corek, kind)
	}

	for _, pp := range corelist.New(nil) {
		for _, kind := range pp.ComposableKinds {
			si, err := kindsys.FindSchemaInterface(kind.Def().Properties.SchemaInterface)
			if err != nil {
				errs = append(errs, err)
				continue
			}

			name := strings.ToLower(fmt.Sprintf("%s/%s", strings.TrimSuffix(kind.Lineage().Name(), si.Name()), si.Name()))
			err = verifyKind(kindRegistry, kind, name, "composable", latestRegistryDir)
			if err != nil {
				errs = append(errs, err)
				continue
			}

			compok = append(compok, kind)
		}
	}

	die(errs...)

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		os.Exit(0)
	}

	// File generation
	jfs := codejen.NewFS()
	outputPath := filepath.Join(".github", "workflows", "scripts", "kinds")

	coreJennies := codejen.JennyList[kindsys.Kind]{}
	coreJennies.Append(
		KindRegistryJenny(outputPath),
	)
	corefs, err := coreJennies.GenerateFS(corek...)
	die(err)
	die(jfs.Merge(corefs))

	composableJennies := codejen.JennyList[kindsys.Composable]{}
	composableJennies.Append(
		ComposableKindRegistryJenny(outputPath),
	)
	composablefs, err := composableJennies.GenerateFS(compok...)
	die(err)
	die(jfs.Merge(composablefs))

	if err = jfs.Write(context.Background(), ""); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

func die(errs ...error) {
	if len(errs) > 0 && errs[0] != nil {
		for _, err := range errs {
			fmt.Fprint(os.Stderr, err, "\n")
		}
		os.Exit(1)
	}
}

// verifyKind verifies that stable kinds are not updated once published (new schemas
// can be added but existing ones cannot be updated)
func verifyKind(registry *kindRegistry, kind kindsys.Kind, name string, category string, latestRegistryDir string) error {
	oldKindString, err := registry.getPublishedKind(name, category, latestRegistryDir)
	if err != nil {
		return err
	}

	var oldKind kindsys.Kind
	if oldKindString != "" {
		switch category {
		case "core":
			oldKind, err = loadCoreKind(name, oldKindString)
		case "composable":
			oldKind, err = loadComposableKind(name, oldKindString)
		default:
			return fmt.Errorf("kind can only be core or composable")
		}
	}
	if err != nil {
		return err
	}

	// Kind is new - no need to compare it
	if oldKind == nil {
		return nil
	}

	// Check that maturity isn't downgraded
	if kind.Maturity().Less(oldKind.Maturity()) {
		return fmt.Errorf("kind maturity can't be downgraded once a kind is published")
	}

	if oldKind.Maturity().Less(kindsys.MaturityStable) {
		return nil
	}

	// Check that old schemas do not contain updates
	err = thema.IsAppendOnly(oldKind.Lineage(), kind.Lineage())
	if err != nil {
		return fmt.Errorf("existing schemas in lineage %s cannot be modified: %w", name, err)
	}

	return nil
}

func isLess(v1 []uint64, v2 []uint64) bool {
	if len(v1) == 1 || len(v2) == 1 {
		return v1[0] < v2[0]
	}

	return v1[0] < v2[0] || (v1[0] == v2[0] && isLess(v1[2:], v2[2:]))
}

func loadCoreKind(name string, kind string) (kindsys.Kind, error) {
	fs := fstest.MapFS{
		fmt.Sprintf("%s.cue", name): &fstest.MapFile{
			Data: []byte(kind),
		},
	}

	rt := cuectx.GrafanaThemaRuntime()

	def, err := cuectx.LoadCoreKindDef(fmt.Sprintf("%s.cue", name), rt.Context(), fs)
	if err != nil {
		return nil, fmt.Errorf("%s is not a valid kind: %w", name, err)
	}

	return kindsys.BindCore(rt, def)
}

func loadComposableKind(name string, kind string) (kindsys.Kind, error) {
	parts := strings.Split(name, "/")
	if len(parts) > 1 {
		name = parts[1]
	}

	fs := fstest.MapFS{
		fmt.Sprintf("%s.cue", name): &fstest.MapFile{
			Data: []byte(kind),
		},
	}

	rt := cuectx.GrafanaThemaRuntime()

	def, err := pfs.LoadComposableKindDef(fs, rt, fmt.Sprintf("%s.cue", name))
	if err != nil {
		return nil, fmt.Errorf("%s is not a valid kind: %w", name, err)
	}

	return kindsys.BindComposable(rt, def)
}

// KindRegistryJenny generates kind files into the "next" folder of the local kind registry.
func KindRegistryJenny(path string) codegen.OneToOne {
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

func (j *kindregjenny) Generate(kind kindsys.Kind) (*codejen.File, error) {
	name := kind.Props().Common().MachineName
	core, ok := kind.(kindsys.Core)
	if !ok {
		return nil, fmt.Errorf("kind sent to KindRegistryJenny must be a core kind")
	}

	newKindBytes, err := kindToBytes(core.Def().V)
	if err != nil {
		return nil, err
	}

	path := filepath.Join(j.path, "next", "core", name, name+".cue")
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
func ComposableKindRegistryJenny(path string) codejen.OneToOne[kindsys.Composable] {
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

func (j *ckrJenny) Generate(k kindsys.Composable) (*codejen.File, error) {
	si, err := kindsys.FindSchemaInterface(k.Def().Properties.SchemaInterface)
	if err != nil {
		panic(err)
	}

	name := strings.ToLower(fmt.Sprintf("%s/%s", strings.TrimSuffix(k.Lineage().Name(), si.Name()), si.Name()))

	newKindBytes, err := kindToBytes(k.Def().V)
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
func (registry *kindRegistry) getPublishedKind(name string, category string, latestRegistryDir string) (string, error) {
	if latestRegistryDir == "" {
		return "", nil
	}

	var cueFilePath string
	switch category {
		case "core":
			cueFilePath = fmt.Sprintf("%s/%s.cue", name, name)
		case "composable":
			cueFilePath = fmt.Sprintf("%s.cue", name)
		default:
		return "", fmt.Errorf("kind can only be core or composable")
	}

	kindPath := filepath.Join(latestRegistryDir, category, cueFilePath)
	file, err := registry.zipFile.Open(kindPath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	return string(data), nil
}
