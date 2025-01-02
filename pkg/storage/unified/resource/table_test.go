package resource

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

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
	builder, err := NewTableBuilder(columns)
	require.NoError(t, err)

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

	// Check the snapshot
	AssertTableSnapshot(t, filepath.Join("testdata", "simple-table.json"), &builder.ResourceTable)
}

func TestColumnEncoding(t *testing.T) {
	tests := []struct {
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
	}{
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_STRING,
			},
			input: "aaa", // expects output to match
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_STRING,
				IsArray: true,
			},
			input:  "bbb",
			output: []any{"bbb"},
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
				Type:    ResourceTableColumnDefinition_INT64,
				IsArray: true,
			},
			input:  12345,
			output: []any{int64(12345)},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_DOUBLE,
			},
			input:  12345,
			output: float64(12345),
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_DOUBLE,
				IsArray: true,
			},
			input:  12345,
			output: []any{float64(12345)},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_BOOLEAN,
			},
			input: true,
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_BOOLEAN,
				IsArray: true,
			},
			input: []any{true, false, true},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_FLOAT,
			},
			input:  23.4,
			output: float32(23.4),
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_FLOAT,
				IsArray: true,
			},
			input:  23.4,
			output: []any{float32(23.4)},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_INT32,
			},
			input:  56,
			output: int32(56),
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_INT32,
				IsArray: true,
			},
			input:  56,
			output: []any{int32(56)},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_DATE_TIME,
			},
			input: time.UnixMilli(946674000000).UTC(),
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_DATE_TIME,
				IsArray: true,
			},
			input: time.UnixMilli(946674000000).UTC(),
			output: []any{
				time.UnixMilli(946674000000).UTC(),
			},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_DATE,
			},
			input: time.UnixMilli(946674000000).UTC(),
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_DATE,
				IsArray: true,
			},
			input: time.UnixMilli(946674000000).UTC(),
			output: []any{
				time.UnixMilli(946674000000).UTC(),
			},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_BINARY,
			},
			input: []byte{1, 2, 3, 4},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_BINARY,
				IsArray: true,
			},
			input: []any{
				[]byte{1, 2, 3, 4},
			},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type: ResourceTableColumnDefinition_OBJECT,
			},
			input: map[string]any{
				"hello": "world",
			},
		},
		{
			def: &ResourceTableColumnDefinition{
				Type:    ResourceTableColumnDefinition_OBJECT,
				IsArray: true,
			},
			input: map[string]any{
				"hello": "world",
			},
			output: []any{
				map[string]any{
					"hello": "world",
				},
			},
		},
	}

	// Keep track of the types that have tests
	testedTypes := make(map[ResourceTableColumnDefinition_ColumnType]bool)
	testedArrays := make(map[ResourceTableColumnDefinition_ColumnType]bool)
	for _, test := range tests {
		var sb strings.Builder
		if test.def.IsArray {
			sb.WriteString("[]")
			testedArrays[test.def.Type] = true
		} else {
			testedTypes[test.def.Type] = true
		}
		sb.WriteString(test.def.Type.String())
		if test.def.Name != "" {
			sb.WriteString("(")
			sb.WriteString(test.def.Name)
			sb.WriteString(")")
		}
		sb.WriteString("=")
		sb.WriteString(fmt.Sprintf("%v", test.input))

		t.Run(sb.String(), func(t *testing.T) {
			t.Parallel()

			col, err := newResourceTableColumn(test.def, 0)
			require.NoError(t, err)

			buff := test.raw
			if buff == nil {
				buff, err = col.Encode(test.input)
				if test.input_err != nil {
					require.Equal(t, test.input_err, err)
				} else {
					require.NoError(t, err)
				}
			}

			out, err := col.Decode(buff)
			if test.output_err != nil {
				require.Equal(t, test.output_err, err)
			} else {
				require.NoError(t, err)
			}

			if test.output != nil {
				require.Equal(t, test.output, out)
			} else {
				require.Equal(t, test.input, out)
			}
		})
	}

	t.Run("ensure type coverage", func(t *testing.T) {
		missingTypes := []string{}
		missingArrays := []string{}

		// Make sure we have at least one test for each type
		for i := ResourceTableColumnDefinition_STRING; i <= ResourceTableColumnDefinition_OBJECT; i++ {
			if !testedTypes[i] {
				missingTypes = append(missingTypes, i.String())
			}
			if !testedArrays[i] {
				missingArrays = append(missingArrays, i.String())
			}
		}

		require.Empty(t, missingTypes, "missing tests for types")
		require.Empty(t, missingArrays, "missing array tests for types")
	})
}
