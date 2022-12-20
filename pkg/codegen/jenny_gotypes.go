package codegen

import (
	"bytes"

	"github.com/dave/dst/decorator"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/thema/encoding/gocode"
	"golang.org/x/tools/go/ast/astutil"
)

// GoTypesJenny creates a [OneToOne] that produces Go types for the provided
// [thema.Schema].
type GoTypesJenny struct{
	ApplyFuncs []astutil.ApplyFunc
}

func (j GoTypesJenny) JennyName() string {
	return "GoTypesJenny"
}

func (j GoTypesJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	// TODO allow using name instead of machine name in thema generator
	b, err := gocode.GenerateTypesOpenAPI(sfg.Schema, &gocode.TypeConfigOpenAPI{
		// TODO will need to account for sanitizing e.g. dashes here at some point
		PackageName: sfg.Schema.Lineage().Name(),
		ApplyFuncs:  append(j.ApplyFuncs, PrefixDropper(sfg.Name)),
	})

	if err != nil {
		return nil, err
	}

	// TODO switch to dst completely so this isn't a hanger-on
	fb, err := decorator.Parse(b)
	if err != nil {
		return nil, err
	}
	dstutil.Apply(fb, DecoderCompactor(), nil)
	buf := new(bytes.Buffer)
	decorator.Fprint(buf, fb)
	b, err = postprocessGoFile(genGoFile{
		path:   "",
		walker: nil,
		in:     buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(sfg.Schema.Lineage().Name()+"_types_gen.go", b, j), nil
}
