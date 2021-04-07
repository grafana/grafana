package main

import (
	"fmt"
	"log"
	"os"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"cuelang.org/go/encoding/openapi"
)

func main() {
	b, err := openAPISchemas(os.Args[1:])
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(b))
}

// openAPISchemas returns OpenAPI schema JSON of the Cue entrypoints passed to
// it. It is not a valid OpenAPI document - just the schemas.
func openAPISchemas(entrypoints []string) ([]byte, error) {

	var r cue.Runtime
	cfg := openapi.Config{
		ExpandReferences: true,
	}
	bis := load.Instances(entrypoints, nil)

	// collect all schemas
	var pairs []openapi.KeyValue
	for _, bi := range bis {
		if bi.Err != nil {
			return nil, bi.Err
		}
		inst, err := r.Build(bi)
		if err != nil {
			return nil, err
		}
		om, err := cfg.Schemas(inst)
		if err != nil {
			return nil, err
		}
		pairs = append(pairs, om.Pairs()...)
	}

	// add all schemas to new ordered map
	om := openapi.OrderedMap{}
	om.SetAll(pairs)

	j, err := om.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return j, nil
}
