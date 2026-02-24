package codegen

import (
	"context"
	"strings"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
	"github.com/grafana/cog"
)

// TSCogTypesJenny is a [OneToOne] that produces TypeScript types and defaults using cog.
type TSCogTypesJenny struct {
	constantToEnum map[string][]string
}

var _ codejen.OneToOne[SchemaForGen] = &TSCogTypesJenny{}

func (j TSCogTypesJenny) JennyName() string {
	return "TSCogTypesJenny"
}

func (j TSCogTypesJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	packageName := strings.ToLower(sfg.Name)
	cueValue := sfg.CueFile.LookupPath(cue.ParsePath("lineage.schemas[0].schema.spec"))

	types := cog.TypesFromSchema().
		CUEValue(packageName, cueValue, cog.ForceEnvelope(sfg.Name)).
		Typescript(cog.TypescriptConfig{})

	if j.constantToEnum != nil {
		types.SchemaTransformations(cog.ConstantToEnum(j.constantToEnum))
	}

	b, err := types.Run(context.Background())
	if err != nil {
		return nil, err
	}

	return codejen.NewFile("types.gen.ts", b[0].Data, j), nil
}
