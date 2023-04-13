package codegen

import (
	"fmt"
	"path/filepath"
	"testing/fstest"

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
	oldKindString, err := GetPublishedKind(name, "core")
	if err != nil {
		return nil, err
	}

	var oldKind kindsys.Kind
	if oldKindString != "" {
		oldKind, err = loadCoreKind(name, oldKindString, "core")
		if err != nil {
			return nil, err
		}
	}

	// File is new - no need to compare with old lineage
	if oldKind != nil && !thema.IsAppendOnly(oldKind.Lineage(), kind.Lineage()) {
		return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
	}

	core, ok := kind.(kindsys.Core)
	if !ok {
		return nil, fmt.Errorf("kind sent to SchemaRegistryJenny must be a core kind")
	}
	newKindBytes, err := KindToBytes(core.Def().V)
	if err != nil {
		return nil, err
	}

	path := filepath.Join(j.path, "next", "core", name+".cue")
	return codejen.NewFile(path, newKindBytes, j), nil
}

func loadCoreKind(name string, kind string, category string) (kindsys.Kind, error) {
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