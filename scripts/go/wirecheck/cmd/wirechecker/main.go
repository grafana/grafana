package main

import (
	"log"

	"golang.org/x/tools/go/analysis/singlechecker"

	"github.com/grafana/grafana/scripts/go/wirecheck"
)

func main() {
	checker, err := wirecheck.New(nil)
	if err != nil {
		log.Fatalf("failed to create wirecheck: %v", err)
		return
	}
	analyzers, err := checker.BuildAnalyzers()
	if err != nil {
		log.Fatalf("failed to build analyzers: %v", err)
		return
	}

	if len(analyzers) > 0 {
		singlechecker.Main(analyzers[0])
	}
}
