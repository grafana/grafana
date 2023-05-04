package main

import (
	"flag"

	modfile "github.com/grafana/grafana/go.mod"
)

func main() {
	// Define command line flags.
	check := flag.String("check", "", "Check if go.mod is valid")
	owners := flag.String("owners", "", "List owners of a particular dependency")
	modules := flag.String("modules", "", "List all dependencies of a particular owner")

	// Parse flags.
	flag.Parse()

	// Parse modfile
	modfile.Parse()
}
