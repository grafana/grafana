package main

import (
	"flag"

	"golang.org/x/tools/go/analysis/singlechecker"

	wirechecker "github.com/grafana/grafana/scripts/go/wirecheck"
)

var wireGenFile = flag.String("wire-gen", "", "path to wire_gen.go file to analyze provider functions from")
var recursive = flag.Bool("recursive", false, "enable recursive analysis of function calls")

func main() {
	flag.Parse()

	// Create a WireChecker instance with command-line settings
	settings := wirechecker.Settings{
		WireGen:   *wireGenFile,
		Recursive: *recursive,
	}

	checker := &wirechecker.WireChecker{}
	checker.SetSettings(settings)

	analyzers, _ := checker.BuildAnalyzers()
	if len(analyzers) > 0 {
		singlechecker.Main(analyzers[0])
	}
}
