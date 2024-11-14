package main

import (
	"os"

	"github.com/grafana/grafana/pkg/util/cmd"
)

func main() {
	os.Exit(cmd.RunGrafanaCmd("cli"))
}
