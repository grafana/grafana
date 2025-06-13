package codegen

import (
	"context"
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/cog"
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
		cueValue := v.CueFile.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))

		b, err := cog.TypesFromSchema().
			CUEValue(packageName, cueValue).
			Golang(cog.GoConfig{}).
			Run(context.Background())
		if err != nil {
			return nil, err
		}

		files[i] = *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_spec_gen.go", packageName, packageName), b[0].Data, jenny)
	}

	return files, nil
}
