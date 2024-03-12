package codegen

import (
	"cuelang.org/go/cue"
	"fmt"
	"github.com/grafana/grafana/pkg/codegen/generators"

	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
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
		b, err := generators.GenerateTypesGo(v.Lineage().Latest(),
			&generators.GoConfig{
				Config: &generators.OpenApiConfig{
					IsGroup:  false,
					RootName: "Spec",
					SubPath:  cue.MakePath(cue.Str("spec")),
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
