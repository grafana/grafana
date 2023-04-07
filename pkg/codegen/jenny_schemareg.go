package codegen

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
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
	oldKind, err := GetPublishedKind(name, j.path, "core")
	if err != nil {
		return nil, err
	}

	core, ok := kind.(kindsys.Core)
	if !ok {
		return nil, fmt.Errorf("kind sent to SchemaRegistryJenny must be a core kind")
	}

	newKindBytes, err := KindToBytes(core.Def().V)
	if err != nil {
		return nil, err
	}

	// File is new - no need to compare with old lineage
	if oldKind != nil && !thema.IsAppendOnly(oldKind.Lineage(), kind.Lineage()) {
		return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
	}

	path := filepath.Join(j.path, "next", "core", name+".cue")
	return codejen.NewFile(path, newKindBytes, j), nil
}
