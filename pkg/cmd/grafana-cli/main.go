package main

import (
	"os"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"

	// TODO(sh0rez): remove once import cycle resolved
	_ "github.com/grafana/grafana/pkg/web/hack"
)

// Version is overridden by build flags
var version = "main"

func main() {
	os.Exit(commands.RunCLI(version))
}
