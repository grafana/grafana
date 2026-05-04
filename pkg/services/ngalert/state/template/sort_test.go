package template

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSortByFunc(t *testing.T) {
	type TestStruct struct {
		Name     string
		Value    int
		Nested   struct{ Field string }
		PtrField *int
	}

	val1 := 10
	val2 := 20
	val3 := 5

	tests := []struct {
		name      string
		field     string
		input     interface{}
		expected  interface{}
		expectErr bool
	}{
		{
			name:  "sort slice of structs by string field",
			field: "Name",
			input: []TestStruct{
				{Name: "c"}, {Name: "a"}, {Name: "b"},
			},
			expected: []TestStruct{
				{Name: "a"}, {Name: "b"}, {Name: "c"},
			},
		},
		{
			name:  "sort slice of structs by int field",
			field: "Value",
			input: []TestStruct{
				{Value: 10}, {Value: 5}, {Value: 20},
			},
			expected: []TestStruct{
				{Value: 5}, {Value: 10}, {Value: 20},
			},
		},
		{
			name:  "sort slice of structs by nested field",
			field: "Nested.Field",
			input: []TestStruct{
				{Nested: struct{ Field string }{"z"}},
				{Nested: struct{ Field string }{"x"}},
				{Nested: struct{ Field string }{"y"}},
			},
			expected: []TestStruct{
				{Nested: struct{ Field string }{"x"}},
				{Nested: struct{ Field string }{"y"}},
				{Nested: struct{ Field string }{"z"}},
			},
		},
		{
			name:  "sort slice of pointers to structs",
			field: "Value",
			input: []*TestStruct{
				{Value: 10}, {Value: 2}, {Value: 5},
			},
			expected: []*TestStruct{
				{Value: 2}, {Value: 5}, {Value: 10},
			},
		},
		{
			name:  "sort slice of structs with pointer field (nil check)",
			field: "PtrField",
			input: []TestStruct{
				{Name: "nil", PtrField: nil},
				{Name: "20", PtrField: &val2},
				{Name: "10", PtrField: &val1},
			},
			expected: []TestStruct{
				{Name: "nil", PtrField: nil},
				{Name: "10", PtrField: &val1},
				{Name: "20", PtrField: &val2},
			},
		},
		{
			name:  "sort slice of structures with pointer fields",
			field: "PtrField",
			input: []TestStruct{
				{Name: "10", PtrField: &val1},
				{Name: "20", PtrField: &val2},
				{Name: "5", PtrField: &val3},
			},
			expected: []TestStruct{
				{Name: "5", PtrField: &val3},
				{Name: "10", PtrField: &val1},
				{Name: "20", PtrField: &val2},
			},
		},
		{
			name:  "sort slice of maps by key",
			field: "key",
			input: []map[string]interface{}{
				{"key": "c", "other": 1},
				{"key": "a", "other": 2},
				{"key": "b", "other": 3},
			},
			expected: []map[string]interface{}{
				{"key": "a", "other": 2},
				{"key": "b", "other": 3},
				{"key": "c", "other": 1},
			},
		},
		{
			name:  "sort slice of maps by nested key does not work directly like this in tests easily but dot notation works",
			field: "key",
			input: []map[string]string{
				{"key": "2"}, {"key": "1"},
			},
			expected: []map[string]string{
				{"key": "1"}, {"key": "2"},
			},
		},
		{
			name:      "error on non-slice input",
			field:     "Name",
			input:     TestStruct{},
			expectErr: true,
		},
		{
			name:      "sort handles invalid field gracefully (returns unsorted or partial? implementation returns error)",
			field:     "NonExistent",
			input:     []TestStruct{{Name: "a"}},
			expectErr: true,
		},
		{
			name:     "nil input returns nil",
			field:    "any",
			input:    nil,
			expected: nil,
		},
		{
			name:     "empty slice returns empty",
			field:    "any",
			input:    []TestStruct{},
			expected: []TestStruct{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res, err := sortByFunc(tc.field, tc.input)
			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expected, res)
			}
		})
	}
}

func TestSortByFunc_InTemplate(t *testing.T) {
	// Verify it works within the Expand function (integration test)
	// We need to Mock Data or use simple data structure

	type Alert struct {
		Labels map[string]string
		Value  float64
	}

	alerts := []Alert{
		{Labels: map[string]string{"foo": "c"}, Value: 1},
		{Labels: map[string]string{"foo": "a"}, Value: 2},
		{Labels: map[string]string{"foo": "b"}, Value: 3},
	}

	// Data struct from template.go has Labels, Values (map), Value.
	// Expand takes Data.
	// We can cheat and pass our custom struct if usage allows, but Expand signature takes Data.
	// However, Expand uses .Data as context.
	// Wait, internal Expand expects Data.
	// But we can test just the sorting of a list variable inside the template.

	tmpl := `{{ range $a := .Value | sortBy "Labels.foo" }}{{ .Labels.foo }},{{ end }}`

	// Create Data where .Value is our list of Alerts (Expand allows .Value to be any)
	d := Data{
		Value: alerts,
	}

	res, err := Expand(context.Background(), "test", tmpl, d, nil, time.Now())
	require.NoError(t, err)
	assert.Equal(t, "a,b,c,", res)
}
