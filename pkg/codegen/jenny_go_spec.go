package codegen

import (
	"fmt"

	"cuelang.org/go/cue"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema/encoding/gocode"
	"github.com/grafana/thema/encoding/openapi"
)

type GoSpecJenny struct {
	ApplyFuncs []dstutil.ApplyFunc
}

func (jenny *GoSpecJenny) JennyName() string {
	return "GoResourceTypes"
}

func (jenny *GoSpecJenny) Generate(kinds ...kindsys.Kind) (codejen.Files, error) {
	files := make(codejen.Files, len(kinds))
	for i, v := range kinds {
		name := v.Lineage().Name()
		b, err := gocode.GenerateTypesOpenAPI(v.Lineage().Latest(),
			&gocode.TypeConfigOpenAPI{
				Config: &openapi.Config{
					Group:    false,
					RootName: "Spec",
					Subpath:  cue.MakePath(cue.Str("spec")),
				},
				PackageName: name,
				ApplyFuncs:  append(jenny.ApplyFuncs, PrefixDropper(v.Props().Common().Name)),
			},
		)

		if err != nil {
			return nil, err
		}

		files[i] = *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_spec_gen.go", name, name), b, jenny)
	}

	return files, nil
}
