package codegen

import (
	"context"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
	"github.com/grafana/cog"
	"github.com/grafana/cuetsy/ts/ast"
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
	cueValue := sfg.CueFile.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))
	opts := make([]cog.CUEOption, 0)
	if sfg.IsGroup {
		opts = append(opts, cog.ForceEnvelope(sfg.Name))
	}

	f, err := cog.
		TypesFromSchema().
		CUEValue(sfg.Name, cueValue, opts...).
		Typescript(cog.TypescriptConfig{}).
		Run(context.Background())

	if err != nil {
		return nil, err
	}

	outputName := sfg.Name
	if sfg.OutputName != "" {
		outputName = sfg.OutputName
	}

	return codejen.NewFile(outputName+"_types.gen.ts", f[0].Data, j), nil
}
