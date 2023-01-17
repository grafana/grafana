package codegen

import (
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/thema/encoding/gocode"
)

// GoTypesJenny creates a [OneToOne] that produces Go types for the provided
// [thema.Schema].
type GoTypesJenny struct {
	ApplyFuncs []dstutil.ApplyFunc
}

func (j GoTypesJenny) JennyName() string {
	return "GoTypesJenny"
}

func (j GoTypesJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	// TODO allow using name instead of machine name in thema generator
	b, err := gocode.GenerateTypesOpenAPI(sfg.Schema, &gocode.TypeConfigOpenAPI{
		// TODO will need to account for sanitizing e.g. dashes here at some point
		PackageName: sfg.Schema.Lineage().Name(),
		ApplyFuncs:  append(j.ApplyFuncs, PrefixDropper(sfg.Name), DecoderCompactor()),
	})

	if err != nil {
		return nil, err
	}

	return codejen.NewFile(sfg.Schema.Lineage().Name()+"_types_gen.go", b, j), nil
}
