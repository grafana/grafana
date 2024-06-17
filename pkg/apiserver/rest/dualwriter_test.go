package rest

import (
	"context"
	"fmt"
	"testing"

	playlist "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestSetDualWritingMode(t *testing.T) {
	type testCase struct {
		name         string
		stackID      string
		desiredMode  DualWriterMode
		expectedMode DualWriterMode
	}
	tests :=
		// #TODO add test cases for kv store failures. Requires adding support in kvstore test_utils.go
		[]testCase{
			{
				name:         "should return a mode 2 dual writer when mode 2 is set as the desired mode",
				stackID:      "stack-1",
				desiredMode:  Mode2,
				expectedMode: Mode2,
			},
			{
				name:         "should return a mode 1 dual writer when mode 1 is set as the desired mode",
				stackID:      "stack-1",
				desiredMode:  Mode1,
				expectedMode: Mode1,
			},
		}

	for _, tt := range tests {
		l := (LegacyStorage)(nil)
		s := (Storage)(nil)
		m := &mock.Mock{}

		ls := legacyStoreMock{m, l}
		us := storageMock{m, s}

		kvStore := kvstore.WithNamespace(kvstore.NewFakeKVStore(), 0, "storage.dualwriting."+tt.stackID)

		p := prometheus.NewRegistry()
		dw, err := SetDualWritingMode(context.Background(), kvStore, ls, us, playlist.GROUPRESOURCE, tt.desiredMode, p)
		assert.NoError(t, err)
		assert.Equal(t, tt.expectedMode, dw.Mode())

		// check kv store
		val, ok, err := kvStore.Get(context.Background(), playlist.GROUPRESOURCE)
		assert.True(t, ok)
		assert.NoError(t, err)
		assert.Equal(t, val, fmt.Sprint(tt.expectedMode))
	}
}

func TestSortUnstructeredMap(t *testing.T) {
	testCase := []struct {
		name     string
		input    map[string]any
		expected []kv
	}{
		{
			name: "sorts a map by key",
			input: map[string]any{
				"a": 1,
				"g": []any{[]string{"a", "b"}, []int{1, 5}},
				"c": map[string]any{"f": map[string]string{"e": "b"}},
				"d": []string{"a", "b"},
				"b": "b",
			},
			expected: []kv{
				{value: 1, key: "a"},
				{value: "b", key: "b"},
				{value: []kv{{value: map[string]string{"e": "b"}, key: "f"}}, key: "c"},
				{value: []string{"a", "b"}, key: "d"},
				{value: []any{[]string{"a", "b"}, []int{1, 5}}, key: "g"},
			},
		},
		{
			name:     "handles empty cases",
			input:    map[string]any{},
			expected: []kv{},
		},
	}

	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			actual := sortUnstructeredMap(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestUnstructuredSlices(t *testing.T) {
	testCase := []struct {
		name     string
		input    []any
		expected []any
	}{
		{
			name: "sorts a slice of unstructured objects",
			input: []any{
				map[string]any{"f": map[string]string{"e": "b"}},
				[]string{"a", "b"},
				[]any{map[int]string{3: "b"}, []map[string]string{{"z": "a"}, {"d": "e"}}},
				[]int{3, 7, 5, 3},
				[]string{"b", "a", "t", "a"},
			},
			expected: []any{
				[]kv{{value: map[string]string{"e": "b"}, key: "f"}},
				[]string{"a", "b"}, []interface{}{map[int]string{3: "b"},
					[]map[string]string{{"z": "a"}, {"d": "e"}}},
				[]int{3, 7, 5, 3},
				[]string{"b", "a", "t", "a"},
			},
		},
		{
			name:     "handles empty cases",
			input:    []any{},
			expected: []any{},
		},
	}

	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			actual := sortUnstructuredSlice(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}
