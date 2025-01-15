package codegen

import (
	"context"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/cog"
)

type TsCommonJenny struct {
	dir string
}

func NewTsCommonJenny(dir string) *TsCommonJenny {
	return &TsCommonJenny{
		dir: dir,
	}
}

func (jenny *TsCommonJenny) JennyName() string {
	return "TsCommonJenny"
}

func (jenny *TsCommonJenny) Generate(_ ...string) (codejen.Files, error) {
	files := make(codejen.Files, 0)
	f, err := cog.TypesFromSchema().
		CUEModule(filepath.Join("..", jenny.dir), cog.CUEImports(map[string]string{
			"common": "",
		})).
		Typescript(cog.TypescriptConfig{}).
		Run(context.Background())

	if err != nil {
		return nil, err
	}

	files = append(files, *codejen.NewFile(filepath.Join(jenny.dir, "common.gen.ts"), f[0].Data, jenny))

	return files, nil
}
