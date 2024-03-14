package codegen

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/codegen/generators"
	"github.com/grafana/grafana/pkg/cuectx"
)

type ApplyFunc func(sfg SchemaForGen, file *ast.File)

// TSTypesJenny is a [OneToOne] that produces TypeScript types and defaults.
type TSTypesJenny struct {
	ApplyFuncs []ApplyFunc
}

var _ codejen.OneToOne[SchemaForGen] = &TSTypesJenny{}

func (j TSTypesJenny) JennyName() string {
	return "TSTypesJenny"
}

func (j TSTypesJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	f, err := generators.GenerateTypesTS(sfg.CueFile, &generators.TSConfig{
		CuetsyConfig: &cuetsy.Config{
			Export:       true,
			ImportMapper: cuectx.MapCUEImportToTS,
		},
		RootName: sfg.Name,
		IsGroup:  sfg.IsGroup,
	})

	for _, renameFunc := range j.ApplyFuncs {
		renameFunc(sfg, f)
	}

	if err != nil {
		return nil, err
	}

	return codejen.NewFile(sfg.Name+"_types.gen.ts", []byte(f.String()), j), nil
}
