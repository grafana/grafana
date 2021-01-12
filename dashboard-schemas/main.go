package main

import (
	"fmt"
	"log"

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

	// collect all schemas
	var pairs []openapi.KeyValue
	for _, bi := range bis {
		if bi.Err != nil {
			log.Fatalf("Error loading: %s", bi.Err)
		}
		inst, err := r.Build(bi)
		if err != nil {
			log.Fatalf("Error building: %s", bi.Err)
		}
		om, err := cfg.Schemas(inst)
		if err != nil {
			log.Fatalf("Error extracting: %s", err)
		}
		pairs = append(pairs, om.Pairs()...)
	}

	// add all schemas to new ordered map
	om := openapi.OrderedMap{}
	om.SetAll(pairs)

	j, err := om.MarshalJSON()
	if err != nil {
		log.Fatalf("Error marshalling json: %s", err)
	}

	fmt.Println(string(j))
}
