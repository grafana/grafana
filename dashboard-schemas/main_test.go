package main

import (
	"encoding/json"
	"testing"
)

func TestOpenAPISchemas(t *testing.T) {

	tests := map[string]struct {
		entrypoints []string
	}{
		"All packages": {
			entrypoints: []string{"./..."},
		},
		"One package": {
			entrypoints: []string{"./panels"},
		},
		"Many packags": {
			entrypoints: []string{
				"./panels",
				"./targets",
				"./transformations",
				"./variables",
			},
		},
	}

	for testName, test := range tests {

		t.Logf("Running test case %s...", testName)

		j, err := openAPISchemas(test.entrypoints)
		if err != nil {
			t.Fatal(err)
		}

		// We don't want to validate the JSON content since it's expected to change
		// often. Only that it is valid JSON by unmarshalling it.

		var iface interface{}
		err = json.Unmarshal(j, &iface)
		if err != nil {
			t.Fatal(err)
		}
	}
}
