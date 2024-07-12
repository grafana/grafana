package rest

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/runtime"
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

		kvStore := &fakeNamespacedKV{data: make(map[string]string), namespace: "storage.dualwriting." + tt.stackID}

		p := prometheus.NewRegistry()
		dwMode, err := SetDualWritingMode(context.Background(), kvStore, ls, us, "playlist.grafana.app/v0alpha1", tt.desiredMode, p)
		assert.NoError(t, err)
		assert.Equal(t, tt.expectedMode, dwMode)

		// check kv store
		val, ok, err := kvStore.Get(context.Background(), "playlist.grafana.app/v0alpha1")
		assert.True(t, ok)
		assert.NoError(t, err)
		assert.Equal(t, val, fmt.Sprint(tt.expectedMode))
	}
}

func TestCompare(t *testing.T) {
	testCase := []struct {
		name     string
		input    runtime.Object
		expected bool
	}{
		{
			name:     "should return true when both objects are the same",
			input:    exampleObj,
			expected: true,
		},
		{
			name:  "should return false when objects are different",
			input: anotherObj,
		},
	}
	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, Compare(tt.input, exampleObj))
		})
	}
}

type fakeNamespacedKV struct {
	namespace string
	data      map[string]string
}

func (f *fakeNamespacedKV) Get(ctx context.Context, key string) (string, bool, error) {
	val, ok := f.data[f.namespace+key]
	return val, ok, nil
}

func (f *fakeNamespacedKV) Set(ctx context.Context, key, value string) error {
	f.data[f.namespace+key] = value
	return nil
}
