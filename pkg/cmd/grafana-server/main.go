package main

import (
	"os"

	cli "github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	"github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
)

// The following variables cannot be constants, since they can be overridden through the -X link flag
var version = "9.2.0"
var commit = "NA"
var buildBranch = "main"
var buildstamp string

func main() {
	if os.Args[0] == "grafana-cli" {
		os.Exit(cli.RunCLI(version))
	}

	os.Exit(commands.RunServer(commands.ServerOptions{
		Version:     version,
		Commit:      commit,
		BuildBranch: buildBranch,
		BuildStamp:  buildstamp,
	}))
}
