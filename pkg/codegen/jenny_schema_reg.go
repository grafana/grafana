package codegen

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/format"
	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
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
	oldLin, err := getPublishedLineage(name, j.path)
	if err != nil {
		return nil, err
	}

	newLinBytes, err := lineageToBytes(kind.Lineage())
	if err != nil {
		return nil, err
	}

	// File is new - no need to compare with old lineage
	if oldLin != nil && !thema.IsAppendOnly(oldLin, kind.Lineage()) {
		return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
	}

	path := filepath.Join(j.path, "next", name+".cue")
	return codejen.NewFile(path, newLinBytes, j), nil
}

func getPublishedLineage(linName string, path string) (thema.Lineage, error) {
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

	bytes, err := os.ReadFile(filepath.Join(path, latestDir, linName+".cue"))
	if err != nil {
		return nil, err
	}

	return load.LineageFromBytes(bytes)
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

func lineageToBytes(lin thema.Lineage) ([]byte, error) {
	node := lin.Underlying().Syntax(
		cue.All(),
		cue.Raw(),
		cue.Schema(),
		cue.Definitions(true),
		cue.Docs(true),
	)

	return format.Node(node)
}
