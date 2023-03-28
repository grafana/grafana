package codegen

import (
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
	path := filepath.Join(j.path, "next", name+"_gen.cue")

	return codejen.NewFile(path, bytes, j), nil
}
