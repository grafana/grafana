package main

import (
	"log"
	"os"

	"github.com/grafana/grafana/pkg/tests/api/apitest"
)

func main() {
	for _, arg := range os.Args[1:] {
		w, err := apitest.NewWorkflow(arg)
		if err != nil {
			log.Fatal(err)
		}
		if err := w.Run(); err != nil {
			log.Fatal(err)
		}
	}
}
