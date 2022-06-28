package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"reflect"
	"strings"

	"github.com/go-openapi/loads"
	"github.com/go-openapi/spec"
)

func mergeVectors(a, b []string) []string {
	for _, p := range b {
		exist := false
		for _, op := range a {
			if op == p {
				exist = true
				break
			}
		}
		if !exist {
			a = append(a, p)
		}
	}
	return a
}

func compareDefinition(a, b spec.Schema) bool {
	return reflect.DeepEqual(a.Type, b.Type) && a.Format == b.Format && reflect.DeepEqual(a.Properties, b.Properties)
}

// mergeSpecs merges OSS API spec with one or more other OpenAPI specs
func mergeSpecs(output string, sources ...string) error {
	if len(sources) < 2 {
		return fmt.Errorf("no APIs to merge")
	}

	f, err := os.Open(sources[0])
	if err != nil {
		return err
	}

	specData, err := ioutil.ReadAll(f)
	if err != nil {
		return err
	}

	var specOSS spec.Swagger
	if err := json.Unmarshal(specData, &specOSS); err != nil {
		return fmt.Errorf("failed to unmarshal original spec: %w", err)
	}

	for _, s := range sources[1:] {
		additionalSpec, err := loads.JSONSpec(s)
		if err != nil {
			return fmt.Errorf("failed to load spec from: %s: %w", s, err)
		}

		// Merge consumes
		specOSS.SwaggerProps.Consumes = mergeVectors(specOSS.SwaggerProps.Consumes, additionalSpec.OrigSpec().Consumes)

		// Merge produces
		specOSS.SwaggerProps.Produces = mergeVectors(specOSS.SwaggerProps.Produces, additionalSpec.OrigSpec().Produces)

		// Merge schemes
		specOSS.SwaggerProps.Schemes = mergeVectors(specOSS.SwaggerProps.Schemes, additionalSpec.OrigSpec().Schemes)

		//TODO: When there are conflict between definitions, we need to error out, but here we need to fix the existing conflict first
		// there are false positives, we will have to fix those by regenerate alerting api spec
		for k, ad := range additionalSpec.OrigSpec().SwaggerProps.Definitions {
			if ossd, exists := specOSS.SwaggerProps.Definitions[k]; exists {
				if !compareDefinition(ad, ossd) {
					fmt.Printf("the definition of %s differs in specs!\n", k)
				}
			}
			specOSS.SwaggerProps.Definitions[k] = ad
		}

		for k, ar := range additionalSpec.OrigSpec().SwaggerProps.Responses {
			if ossr, exists := specOSS.SwaggerProps.Responses[k]; exists {
				if !reflect.DeepEqual(ar, ossr) {
					fmt.Printf("the definition of response %s differs in specs!\n", k)
				}
			}
			specOSS.SwaggerProps.Responses[k] = ar
		}

		for k, p := range additionalSpec.OrigSpec().SwaggerProps.Parameters {
			specOSS.SwaggerProps.Parameters[k] = p
		}

		paths := additionalSpec.OrigSpec().SwaggerProps.Paths
		if paths != nil {
			for k, pi := range paths.Paths {
				kk := strings.TrimPrefix(k, specOSS.BasePath) // remove base path if exists
				if specOSS.SwaggerProps.Paths == nil {
					specOSS.SwaggerProps.Paths = &spec.Paths{
						Paths: make(map[string]spec.PathItem),
					}
				}
				specOSS.SwaggerProps.Paths.Paths[kk] = pi
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

	f, err = os.Create(output)
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
	output := flag.String("o", "../../../swagger-ui/merged.json", "the output path")
	flag.Parse()
	err := mergeSpecs(*output, flag.Args()...)
	if err != nil {
		fmt.Printf("something went wrong: %s\n", err.Error())
	}
}
