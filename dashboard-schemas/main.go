package main

import (
	"fmt"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"cuelang.org/go/encoding/openapi"
)

func main() {

	var r cue.Runtime
	cfg := openapi.Config{
		ExpandReferences: true,
	}
	entrypoints := []string{"./..."}
	bis := load.Instances(entrypoints, nil)

	for _, bi := range bis {

		if bi.Err != nil {
			fmt.Println("Error during load:", bi.Err)
			continue
		}

		inst, err := r.Build(bi)
		if err != nil {
			fmt.Println("Error during build:", bi.Err)
			continue
		}

		oapi, err := openapi.Gen(inst, &cfg)
		if err != nil {
			fmt.Println("Error during gen:", err)
			continue
		}

		fmt.Println(string(oapi))
	}
}
