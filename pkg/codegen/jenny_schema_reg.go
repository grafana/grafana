package codegen

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/format"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

// SchemaRegistryJenny generates lineage files into the "next" folder
// of the local schema registry.
func SchemaRegistryJenny(path string) OneToOne {
	return &schemaregjenny{
		path: path,
	}
}

type schemaregjenny struct {
	path string
}

func (j *schemaregjenny) JennyName() string {
	return "SchemaRegistryJenny"
}

func (j *schemaregjenny) Generate(kind kindsys.Kind) (*codejen.File, error) {
	name := kind.Props().Common().MachineName
	oldKind, err := getPublishedKind(name, j.path)
	if err != nil {
		return nil, err
	}

	newKindBytes, err := kindToBytes(kind)
	if err != nil {
		return nil, err
	}

	// File is new - no need to compare with old lineage
	if oldKind != nil && !thema.IsAppendOnly(oldKind.Lineage(), kind.Lineage()) {
		return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
	}
	
	path := filepath.Join(j.path, "next", name+".cue")
	return codejen.NewFile(path, newKindBytes, j), nil
}

func getPublishedKind(name string, path string) (kindsys.Kind, error) {
	wd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("error retrieving working directory: %w", err)
	}

	groot := filepath.Dir(wd)
	path = filepath.Join(groot, path)

	latestDir, err := findLatestDir(path)
	if err != nil {
		return nil, err
	}

	if latestDir == "" {
		return nil, nil
	}

	bytes, err := os.ReadFile(filepath.Join(path, latestDir, name + ".cue"))
	if err != nil {
		return nil, err
	}

	return loadKindFromBytes(name, bytes)
}

func findLatestDir(path string) (string, error) {
	re := regexp.MustCompile(`([0-9]+)\.([0-9]+)\.([0-9]+)`)
	latestVersion := []uint64{0, 0, 0}
	latestDir := ""

	if _, err := os.Stat(path); err != nil {
		return "", nil
	}

	files, err := os.ReadDir(path)
	if err != nil {
		return "", err
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

func isLess(v1 []uint64, v2 []uint64) bool {
	if len(v1) == 1 || len(v2) == 1 {
		return v1[0] < v2[0]
	}

	return v1[0] < v2[0] || (v1[0] == v2[0] && isLess(v1[2:], v2[2:]))
}

func kindToBytes(kind kindsys.Kind) ([]byte, error) {
	var value cue.Value
	switch tkind := kind.(type) {
	case kindsys.Core:
		value = tkind.Def().V
	case kindsys.Composable:
		value = tkind.Def().V
	case kindsys.Custom:
		value = tkind.Def().V
	default:
		return nil, fmt.Errorf("kind must be core, composable or custom")
	}

	node := value.Syntax(
		cue.All(),
		cue.Raw(),
		cue.Schema(),
		cue.Definitions(true),
		cue.Docs(true),
		cue.Hidden(true),
	)

	return format.Node(node)
}

func loadKindFromBytes(name string, kind []byte) (kindsys.Kind, error) {
	fs := fstest.MapFS{
		fmt.Sprintf("%s.cue", name): &fstest.MapFile{
			Data: kind,
		},
	}

	rt := cuectx.GrafanaThemaRuntime()

	def, err := cuectx.LoadCoreKindDef(fmt.Sprintf("%s.cue", name), rt.Context(), fs)
	if err != nil {
		return nil, fmt.Errorf("%s is not a valid kind: %w", name, err)
	}

	return kindsys.BindCore(rt, def)
}