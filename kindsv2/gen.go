//go:generate go run gen.go

package main

import (
	"context"
	"os"

	"github.com/grafana/cog"
)

type codegenTargets struct {
	modulePath        string
	outputPath        string
	cueImportsMap     map[string]string
	packagesImportMap map[string]string
}

func main() {
	targets := []codegenTargets{
		{
			modulePath: "../packages/grafana-schema/src/schema/dashboard/v2alpha0/",
			outputPath: "../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.gen.ts",
			cueImportsMap: map[string]string{
				"github.com/grafana/grafana/packages/grafana-schema/src/common": "../packages/grafana-schema/src/common",
			},
			packagesImportMap: map[string]string{
				"common": "@grafana/schema",
			},
		},
	}

	for _, target := range targets {
		codegenPipeline := cog.TypesFromSchema().
			CUEModule(
				target.modulePath,
				cog.CUEImports(target.cueImportsMap),
			).
			Typescript(cog.TypescriptConfig{
				ImportsMap:        target.packagesImportMap,
				EnumsAsUnionTypes: true,
			})

		files, err := codegenPipeline.Run(context.Background())
		if err != nil {
			panic(err)
		}

		if err := os.WriteFile(target.outputPath, files[0].Data, 0644); err != nil {
			panic(err)
		}
	}
}
