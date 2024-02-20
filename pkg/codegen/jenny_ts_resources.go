package codegen

import (
	"fmt"
	"github.com/grafana/codejen"
	"github.com/grafana/cog/cog"
	"path/filepath"
)

var tsCoreKindParentPath = filepath.Join("packages", "grafana-schema", "src", "raw")
var runtimePath = ""
var importFormat = "@grafana/schema/src/raw/%s"

type TSResources struct{}

func (j TSResources) JennyName() string {
	return "JennyTSResources"
}

func (j TSResources) Generate(data DataForGen) (codejen.Files, error) {
	cfg := cog.Config{
		Debug:     true,
		FileDirs:  data.Files,
		OutputDir: tsCoreKindParentPath,
		Languages: cog.Languages{cog.TSLanguage},
		Kind:      cog.Kind(data.Kind),
		RenameOutputFunc: func(pkg string) string {
			return filepath.Join(fmt.Sprintf("%s/x", pkg), fmt.Sprintf("%s_types.gen.ts", pkg))
		},
		TSConfig: cog.TSConfig{
			GenTSIndex:  false,
			GenRuntime:  true,
			RuntimePath: &runtimePath,
			ImportMapper: func(pkg string) string {
				format := fmt.Sprintf(importFormat, pkg)
				// Ugh!!! Do we still needing types under "x" folder?
				if pkg != "cog" {
					format = fmt.Sprintf("%s/x/%s_types.gen", format, pkg)
				}

				return format
			},
		},
	}
	g, err := cog.NewGen(cfg)
	if err != nil {
		return nil, err
	}

	return g.Generate()
}
