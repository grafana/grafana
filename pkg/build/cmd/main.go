package main

import (
	"log"
	"os"

	"github.com/grafana/grafana/pkg/build/daggerbuild/cmd"
)

func main() {
	// TODO change the registerer if the user is running using a JSON file etc
	for k, v := range cmd.Artifacts {
		if err := cmd.GlobalCLI.Register(k, v); err != nil {
			panic(err)
		}
	}

	app := cmd.GlobalCLI.App()

	if err := app.Run(os.Args); err != nil {
		log.Fatalln(err)
	}
}
