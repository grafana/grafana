package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing/fstest"

	"cuelang.org/go/cue"
	cueformat "cuelang.org/go/cue/format"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

// This script verifies that stable kinds are not updated once published (new schemas
// can be added but existing ones cannot be updated).
// If the env variable CODEGEN_VERIFY is not present, this also generates kind files into a
// local "next" folder, ready to be published in the kind-registry repo.
// If kind names are given as parameters, the script will make the above actions only for the
// given kinds.
func main() {
	if len(os.Args) < 2 {
		die(fmt.Errorf("registry path is required"))
	}

	var kindArgs []string
	var corek []kindsys.Kind
	var compok []kindsys.Composable

	registry := NewKindRegistry(os.Args[1])

	if len(os.Args) > 2 {
		kindArgs = os.Args[2:]
	}

	// Search for the latest version directory present in the kind-registry repo
	latestRegistryDir, err := registry.FindLatestDir()
	if err != nil {
		die(fmt.Errorf("failed to get latest directory for published kinds: %s", err))
	}

	errs := make([]error, 0)

	// Kind verification
	for _, kind := range corekind.NewBase(nil).All() {
		if len(kindArgs) > 0 && !contains(kindArgs, kind.Name()) {
			continue
		}

		name := kind.Props().Common().MachineName
		err := verifyKind(registry, kind, name, "core", latestRegistryDir)
		if err != nil {
			errs = append(errs, err)
			continue
		}

		corek = append(corek, kind)
	}

	for _, pp := range corelist.New(nil) {
		// ElasticSearch composable kind causes the CUE evaluator to hand
		// see https://github.com/grafana/grafana/pull/68034#discussion_r1187800059
		if pp.Properties.Id == "elasticsearch" {
			continue
		}

		for _, kind := range pp.ComposableKinds {
			if len(kindArgs) > 0 && !contains(kindArgs, kind.Name()) {
				continue
			}

			si, err := kindsys.FindSchemaInterface(kind.Def().Properties.SchemaInterface)
			if err != nil {
				errs = append(errs, err)
				continue
			}

			name := strings.ToLower(fmt.Sprintf("%s/%s", strings.TrimSuffix(kind.Lineage().Name(), si.Name()), si.Name()))
			err = verifyKind(registry, kind, name, "composable", latestRegistryDir)
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
		KindRegistryJenny(outputPath, kindArgs),
	)
	corefs, err := coreJennies.GenerateFS(corek...)
	die(err)
	die(jfs.Merge(corefs))

	composableJennies := codejen.JennyList[kindsys.Composable]{}
	composableJennies.Append(
		ComposableKindRegistryJenny(outputPath, kindArgs),
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
		fmt.Println("Run `go run verify-kinds.go <registry path> <kind name>...` to run the script on a limited set of kinds.")
		os.Exit(1)
	}
}

// verifyKind verifies that stable kinds are not updated once published (new schemas
// can be added but existing ones cannot be updated)
func verifyKind(registry *kindRegistry, kind kindsys.Kind, name string, category string, latestRegistryDir string) error {
	oldKindString, err := registry.GetPublishedKind(name, category, latestRegistryDir)
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
			Data: []byte("package grafanaplugin\n" + kind),
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
func KindRegistryJenny(path string, kindSet []string) codegen.OneToOne {
	return &kindregjenny{
		path:    path,
		kindSet: kindSet,
	}
}

type kindregjenny struct {
	path    string
	kindSet []string
}

func (j *kindregjenny) JennyName() string {
	return "KindRegistryJenny"
}

func (j *kindregjenny) Generate(kind kindsys.Kind) (*codejen.File, error) {
	if len(j.kindSet) > 0 && !contains(j.kindSet, kind.Name()) {
		return nil, nil
	}

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
func ComposableKindRegistryJenny(path string, kindSet []string) codejen.OneToOne[kindsys.Composable] {
	return &ckrJenny{
		path:    path,
		kindSet: kindSet,
	}
}

type ckrJenny struct {
	path    string
	kindSet []string
}

func (j *ckrJenny) JennyName() string {
	return "ComposableKindRegistryJenny"
}

func (j *ckrJenny) Generate(k kindsys.Composable) (*codejen.File, error) {
	if len(j.kindSet) > 0 && !contains(j.kindSet, k.Name()) {
		return nil, nil
	}

	si, err := kindsys.FindSchemaInterface(k.Def().Properties.SchemaInterface)
	if err != nil {
		panic(err)
	}

	name := strings.ToLower(fmt.Sprintf("%s/%s", strings.TrimSuffix(k.Lineage().Name(), si.Name()), si.Name()))

	newKindBytes, err := kindToBytes(k.Def().V)
	if err != nil {
		return nil, err
	}

	newKindBytes = []byte(fmt.Sprintf("package kind\n\n%s", newKindBytes))

	return codejen.NewFile(filepath.Join(j.path, "next", "composable", name+".cue"), newKindBytes, j), nil
}

type kindRegistry struct {
	rootDir string
}

func NewKindRegistry(rootDir string) *kindRegistry {
	return &kindRegistry{
		rootDir: rootDir,
	}
}

// FindLatestDir gets the latest version directory published in the kind registry.
func (registry *kindRegistry) FindLatestDir() (string, error) {
	re := regexp.MustCompile(`([0-9]+)\.([0-9]+)\.([0-9]+)`)
	latestVersion := []uint64{0, 0, 0}
	latestDir := ""

	files, err := os.ReadDir(registry.rootDir)
	if err != nil {
		return "", fmt.Errorf("could not open registry '%s': %w", registry.rootDir, err)
	}

	for _, file := range files {
		if !file.IsDir() {
			continue
		}

		parts := re.FindStringSubmatch(file.Name())
		if parts == nil || len(parts) < 4 {
			continue
		}

		version := make([]uint64, len(parts)-1)
		for i := 1; i < len(parts); i++ {
			version[i-1], _ = strconv.ParseUint(parts[i], 10, 32)
		}

		if isLess(latestVersion, version) {
			latestVersion = version
			latestDir = file.Name()
		}
	}

	return latestDir, nil
}

// GetPublishedKind retrieves the latest published kind from the kind registry.
func (registry *kindRegistry) GetPublishedKind(name string, category string, latestRegistryDir string) (string, error) {
	if latestRegistryDir == "" {
		return "", nil
	}

	kindPath := filepath.Join(
		registry.rootDir,
		fmt.Sprintf("grafana/%s/%s/%s.cue", latestRegistryDir, category, name),
	)
	content, err := os.ReadFile(kindPath)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

func contains(array []string, value string) bool {
	for _, v := range array {
		if v == value {
			return true
		}
	}

	return false
}
