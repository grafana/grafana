package codegen

import (
	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
)

func FlattenJenny(gen codejen.OneToOne[*corecodegen.DeclForGen]) codejen.OneToMany[[]*corecodegen.DeclForGen] {
	return &flattenJenny{
		inner: gen,
	}
}

type flattenJenny struct {
	inner codejen.OneToOne[*corecodegen.DeclForGen]
}

func (gen *flattenJenny) JennyName() string {
	return "FlattenJenny"
}

func (gen *flattenJenny) Generate(decls []*corecodegen.DeclForGen) (codejen.Files, error) {
	files := make(codejen.Files, len(decls))

	for _, decl := range decls {
		file, err := gen.inner.Generate(decl)
		if err != nil {
			continue
		}
		files = append(files, *file)
	}

	return files, nil
}
