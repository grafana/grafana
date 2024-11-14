package codegen

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen/generators"
)

type GoSpecJenny struct {
	ApplyFuncs []dstutil.ApplyFunc
}

func (jenny *GoSpecJenny) JennyName() string {
	return "GoResourceTypes"
}

func (jenny *GoSpecJenny) Generate(sfg ...SchemaForGen) (codejen.Files, error) {
	files := make(codejen.Files, len(sfg))
	for i, v := range sfg {
		packageName := strings.ToLower(v.Name)
		b, err := generators.GenerateTypesGo(v.CueFile,
			&generators.GoConfig{
				Config: &generators.OpenApiConfig{
					IsGroup:  false,
					RootName: "Spec",
					SubPath:  cue.MakePath(cue.Str("spec")),
				},
				PackageName: packageName,
				ApplyFuncs:  append(jenny.ApplyFuncs, PrefixDropper(v.Name)),
			},
		)

		if err != nil {
			return nil, err
		}

		files[i] = *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_spec_gen.go", packageName, packageName), b, jenny)
	}

	return files, nil
}
