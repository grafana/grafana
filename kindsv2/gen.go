//go:generate go run gen.go

package main

import (
	"context"
	"os"

	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/cog"
)

type codegenTargets struct {
	schemaPath string
	outputPath string
}

func main() {
	cueCtx := cuecontext.New()

	targets := []codegenTargets{
		{
			schemaPath: "../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.schema.cue",
			outputPath: "../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.gen.ts",
		},
	}

	for _, target := range targets {
		rawSchema, err := os.ReadFile(target.schemaPath)
		if err != nil {
			panic(err)
		}

		value := cueCtx.CompileBytes(rawSchema)
		if value.Err() != nil {
			panic(value.Err())
		}

		codegenPipeline := cog.TypesFromSchema().
			CUEValue("dashboard", value).
			Typescript()

		tsBytes, err := codegenPipeline.Run(context.Background())
		if err != nil {
			panic(err)
		}

		if err := os.WriteFile(target.outputPath, tsBytes, 0644); err != nil {
			panic(err)
		}
	}
}
