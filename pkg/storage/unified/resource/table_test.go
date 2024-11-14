package resource

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTableFormat(t *testing.T) {
	table := ResourceTable{
		ResourceVersion:    1234,
		NextPageToken:      "next",
		RemainingItemCount: 7,
		Columns: []*ResourceTableColumnDefinition{
			{
				Name: "title",
				Type: ResourceTableColumnDefinition_STRING,
			},
			{
				Name: "stats.count",
				Type: ResourceTableColumnDefinition_INT64,
			},
			{
				Name:        "number",
				Description: "float64 value",
				Type:        ResourceTableColumnDefinition_DOUBLE,
			},
		},
	}

	err := table.AddRow(&ResourceKey{
		Namespace: "default",
		Group:     "ggg",
		Resource:  "xyz", // does not have a home in table!
		Name:      "aaa",
	}, 10, []any{"aaa", 123, 1.23}, nil)
	require.NoError(t, err)

	err = table.AddRow(&ResourceKey{
		Namespace: "default",
		Group:     "ggg",
		Resource:  "xyz",
		Name:      "bbb",
	}, 11, []any{"bbb", 456, 78}, nil) // note that 78 is an int, not double (OK?)
	require.NoError(t, err)

	err = table.AddRow(&ResourceKey{
		Namespace: "default",
		Group:     "ggg",
		Resource:  "xyz",
		Name:      "ccc",
	}, 12, []any{"ccc", nil, 99}, nil) // note that 78 is an int, not double (OK?)
	require.NoError(t, err)

	after, err := table.ToK8s(false)
	require.NoError(t, err)
	jsraw, _ := json.MarshalIndent(after, "", "  ")
	// fmt.Printf("%s\n", string(jsraw))
	require.JSONEq(t, `{
		"metadata": {
			"resourceVersion": "1234",
			"continue": "next",
			"remainingItemCount": 7
		},
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
			}
		],
		"rows": [
			{
				"cells": [
					"aaa",
					123,
					1.23
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
					"bbb",
					456,
					78
				],
				"object": {
					"metadata": {
						"name": "bbb",
						"namespace": "default",
						"resourceVersion": "11",
						"creationTimestamp": null
					}
				}
			},
			{
				"cells": [
					"ccc",
					null,
					99
				],
				"object": {
					"metadata": {
						"name": "ccc",
						"namespace": "default",
						"resourceVersion": "12",
						"creationTimestamp": null
					}
				}
			}
		]
	}`, string(jsraw))

	parsed, err := table.ToK8s(true)
	require.NoError(t, err)
	parsedjs, _ := json.MarshalIndent(parsed, "", "  ")
	require.JSONEq(t, string(jsraw), string(parsedjs))
}
