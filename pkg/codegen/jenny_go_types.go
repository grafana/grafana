package codegen

import (
	"fmt"
	"path/filepath"
	"strings"
	
	"github.com/grafana/codejen"
	"github.com/grafana/cog/cog"
)

type GoTypesJenny struct {
}

func (jenny *GoTypesJenny) JennyName() string {
	return "GoTypesJenny"
}

func (jenny *GoTypesJenny) Generate(data DataForGen) (codejen.Files, error) {
	cfg := cog.Config{
		Debug:       true,
		FileDirs:    data.Files,
		OutputDir:   "pkg/kinds",
		Languages:   cog.Languages{cog.GoLanguage},
		Kind:        cog.Kind(data.Kind),
		PackageRoot: "github.com/grafana/grafana/pkg/kinds",
	}
	g, err := cog.NewGen(cfg)
	if err != nil {
		return nil, err
	}

	files, err := g.Generate()
	if err != nil {
		return nil, fmt.Errorf("error generating go types: %s", err)
	}

	for i, f := range files {
		if filepath.Base(f.RelativePath) != "types_gen.go" {
			continue
		}

		dir := filepath.Dir(f.RelativePath)
		splitDir := strings.Split(dir, "/")
		name := splitDir[len(splitDir)-1]
		files[i].RelativePath = filepath.Join(dir, fmt.Sprintf("%s_spec_gen.go", name))
	}

	return files, nil
}
