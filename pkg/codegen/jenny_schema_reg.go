package codegen

import (
	"fmt"
	"os"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/format"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
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
	// Get 
	wd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("error retrieving working directory", err)
	}

	groot := filepath.Join(wd, "..", "..")
	bytes, err := os.ReadFile(filepath.Join(groot, "latest.json"))

	type latestJSON struct {
		Stable  string `json:"stable"`
	}
	var latest latestJSON
	err = json.Unmarshal(bytes, &latest)
	if err != nil {
		return nil fmt.Errorf("error unmarshalling latest.json", err)
	}

	node := kind.Lineage().Underlying().Syntax(
		cue.All(),
		cue.Definitions(true),
		cue.Docs(true),
	)

	bytes, err := format.Node(node)
	if err != nil {
		return nil, err
	}

	name := kind.Props().Common().MachineName
	path := filepath.Join(j.path, latest.Stable, name+"_gen.cue")

	return codejen.NewFile(path, bytes, j), nil
}
