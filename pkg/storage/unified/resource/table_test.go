package resource

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTableFormat(t *testing.T) {
	columns := []*ResourceTableColumnDefinition{
		{
			Name: "title",
			Type: ResourceTableColumnDefinition_STRING,
		},
		{
			Name: "stats.count",
			Type: ResourceTableColumnDefinition_INT64,
		},
		{
			Name: "number",
			Type: ResourceTableColumnDefinition_DOUBLE,

			Description: "float64 value",
		},
		{
			Name:    "tags",
			Type:    ResourceTableColumnDefinition_STRING,
			IsArray: true,
		},
	}

	var err error
	builder := NewTableBuilder(columns)

	err = builder.AddRow(&ResourceKey{
		Namespace: "default",
		Group:     "ggg",
		Resource:  "xyz", // does not have a home in table!
		Name:      "aaa",
	}, 10, map[string]any{
		"title":  "AAA",
		"number": 12345,
		"tags":   "one", // becomes an array
	})
	require.NoError(t, err)

	err = builder.AddRow(&ResourceKey{
		Namespace: "default",
		Group:     "ggg",
		Resource:  "xyz", // does not have a home in table!
		Name:      "bbb",
	}, 10, map[string]any{
		"title":       "BBB",
		"stats.count": 12345,
		"tags":        []string{"one", "two"}, // becomes an array
	})
	require.NoError(t, err)

	after, err := builder.ToK8s()
	require.NoError(t, err)
	jsraw, _ := json.MarshalIndent(after, "", "  ")
	fmt.Printf("%s\n", string(jsraw))
	require.JSONEq(t, `{
		"metadata": {},
		"columnDefinitions": [
			{
				"name": "title",
				"type": "string",
				"format": "",
				"description": "",
				"priority": 0
			},
			{
				"name": "stats.count",
				"type": "number",
				"format": "int64",
				"description": "",
				"priority": 0
			},
			{
				"name": "number",
				"type": "number",
				"format": "double",
				"description": "float64 value",
				"priority": 0
			},
			{
				"name": "tags",
				"type": "string",
				"format": "",
				"description": "",
				"priority": 0
			}
		],
		"rows": [
			{
				"cells": [
					"AAA",
					null,
					12345,
					[
						"one"
					]
				],
				"object": {
					"metadata": {
						"name": "aaa",
						"namespace": "default",
						"resourceVersion": "10",
						"creationTimestamp": null
					}
				}
			},
			{
				"cells": [
					"BBB",
					12345,
					null,
					[
						"one",
						"two"
					]
				],
				"object": {
					"metadata": {
						"name": "bbb",
						"namespace": "default",
						"resourceVersion": "10",
						"creationTimestamp": null
					}
				}
			}
		]
	}`, string(jsraw))
}

func TestColumnEncoding(t *testing.T) {
	type check struct {
		// The table definition
		def *ResourceTableColumnDefinition

		// Passed to the encode function
		input any

		// Expected error from input
		input_err error

		// Skip the encode step
		raw []byte

		// Expected output from decode
		output any

		// Expected error from decode
		output_err error
	}

	checks := []check{
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_STRING,
				IsArray: true,
			},
			input:  "aaa",
			output: []any{"aaa"},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_INT64,
			},
			input:  12345,
			output: int64(12345),
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_DOUBLE,
			},
			input:  12345,
			output: float64(12345),
		},
	}

	var err error
	for _, tst := range checks {
		col := NewResourceTableColumn(tst.def, 0)

		buff := tst.raw
		if buff == nil {
			buff, err = col.Encode(tst.input)
			if tst.input_err != nil {
				require.Equal(t, tst.input_err, err)
			} else {
				require.NoError(t, err)
			}
		}

		out, err := col.Decode(buff)
		if tst.output_err != nil {
			require.Equal(t, tst.output_err, err)
		} else {
			require.NoError(t, err)
		}

		if tst.output != nil {
			require.Equal(t, tst.output, out)
		} else {
			require.Equal(t, tst.input, out)
		}
	}
}
