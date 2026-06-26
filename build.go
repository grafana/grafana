// +build ignore

package main

import (
	"log"
	"os"

	"github.com/grafana/grafana/pkg/build"
)

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(0)
	os.Exit(build.RunCmd())
}
