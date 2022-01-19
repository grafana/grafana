package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"os"

	"github.com/go-openapi/loads"
	"github.com/go-openapi/spec"
)

//go:embed spec.json
var specData []byte

// mergeSpecs merges OSS API spec with one or more other OpenAPI specs
func mergeSpecs(sources ...string) error {
	if len(sources) == 0 {
		return fmt.Errorf("no APIs to merge")
	}

	var specOSS spec.Swagger
	err := json.Unmarshal(specData, &specOSS)
	if err != nil {
		return fmt.Errorf("failed to unmarshal original spec: %w", err)
	}

	for _, s := range sources {
		additionalSpec, err := loads.JSONSpec(s)
		if err != nil {
			return fmt.Errorf("failed to load spec from: %s: %w", s, err)
		}

		//TODO: consumes, produces, schemes

		//TODO: check for conflicts
		for k, d := range additionalSpec.OrigSpec().SwaggerProps.Definitions {
			specOSS.SwaggerProps.Definitions[k] = d
		}

		for k, r := range additionalSpec.OrigSpec().SwaggerProps.Responses {
			specOSS.SwaggerProps.Responses[k] = r
		}

		for k, p := range additionalSpec.OrigSpec().SwaggerProps.Parameters {
			specOSS.SwaggerProps.Parameters[k] = p
		}

		paths := additionalSpec.OrigSpec().SwaggerProps.Paths
		if paths != nil {
			for k, pi := range paths.Paths {
				if specOSS.SwaggerProps.Paths == nil {
					specOSS.SwaggerProps.Paths = &spec.Paths{
						Paths: make(map[string]spec.PathItem),
					}
				}
				specOSS.SwaggerProps.Paths.Paths[k] = pi
			}
		}

		specOSS.SwaggerProps.Tags = append(specOSS.SwaggerProps.Tags, additionalSpec.OrigSpec().SwaggerProps.Tags...)
	}

	// write result to file
	newSpec, err := specOSS.MarshalJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal result spec: %w", err)
	}

	var prettyJSON bytes.Buffer
	err = json.Indent(&prettyJSON, newSpec, "", "\t")
	if err != nil {
		return fmt.Errorf("failed to intend new spec: %w", err)
	}

	f, err := os.Create("merged.json")
	if err != nil {
		return fmt.Errorf("failed to create file for new spec: %w", err)
	}

	_, err = f.Write(prettyJSON.Bytes())
	if err != nil {
		return fmt.Errorf("failed to write new spec: %w", err)
	}

	// validate result
	return nil
}

func main() {
	err := mergeSpecs(os.Args[1:]...)
	if err != nil {
		fmt.Printf("something went wrong: %s\n", err.Error())
	}
}
