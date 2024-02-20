package codegen

import (
	"fmt"
	"github.com/grafana/codejen"
	"github.com/grafana/cog/cog"
	"path/filepath"
)

type GoTypesJenny struct {
}

func (jenny *GoTypesJenny) JennyName() string {
	return "GoTypesJenny"
}

func (jenny *GoTypesJenny) Generate(data DataForGen) (codejen.Files, error) {
	cfg := cog.Config{
		Debug:     true,
		FileDirs:  data.Files,
		OutputDir: "pkg/kinds",
		Languages: cog.Languages{cog.GoLanguage},
		Kind:      cog.Kind(data.Kind),
		RenameOutputFunc: func(pkg string) string {
			return filepath.Join(pkg, fmt.Sprintf("%s_spec_gen.go", pkg))
		},
		GoConfig: cog.GoConfig{PackageRoot: "github.com/grafana/grafana/pkg/kinds"},
	}
	g, err := cog.NewGen(cfg)
	if err != nil {
		return nil, err
	}

	return g.Generate()
}
