package codegen

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema/encoding/typescript"
)

// TSTypesJenny is a [OneToOne] that produces TypeScript types and
// defaults for a Thema schema.
//
// Thema's generic TS jenny will be able to replace this one once
// https://github.com/grafana/thema/issues/89 is complete.
type TSTypesJenny struct{}

var _ codejen.OneToOne[SchemaForGen] = &TSTypesJenny{}

func (j TSTypesJenny) JennyName() string {
	return "TSTypesJenny"
}

func (j TSTypesJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	// TODO allow using name instead of machine name in thema generator
	f, err := typescript.GenerateTypes(sfg.Schema, &typescript.TypeConfig{
		CuetsyConfig: &cuetsy.Config{
			Export:       true,
			ImportMapper: cuectx.MapCUEImportToTS,
		},
		RootName: sfg.Name,
		Group:    sfg.IsGroup,
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(sfg.Schema.Lineage().Name()+"_types.gen.ts", []byte(f.String()), j), nil
}
