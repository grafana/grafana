package main

import (
	"os"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
)

// Version is overridden by build flags
var version = "main"

func main() {
	os.Exit(commands.RunCLI(version))
}
