package rest

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	"k8s.io/apiserver/pkg/endpoints/request"
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

		m.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
		m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)

		ls := legacyStoreMock{m, l}
		us := storageMock{m, s}

		kvStore := &fakeNamespacedKV{data: make(map[string]string), namespace: "storage.dualwriting." + tt.stackID}

		dwMode, err := SetDualWritingMode(context.Background(), kvStore, ls, us, "playlist.grafana.app/v0alpha1", tt.desiredMode, p, &fakeServerLock{}, &request.RequestInfo{})
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
	var exampleObjGen1 = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 1}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjGen2 = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjDifferentTitle = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "two"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}

	testCase := []struct {
		name     string
		input1   runtime.Object
		input2   runtime.Object
		expected bool
	}{
		{
			name:     "should return true when both objects are the same",
			input1:   exampleObj,
			input2:   exampleObj,
			expected: true,
		},
		{
			name:     "should return true when objects are the same, but different metadata (generation)",
			input1:   exampleObjGen1,
			input2:   exampleObjGen2,
			expected: true,
		},
		{
			name:     "should return false when objects are different",
			input1:   exampleObjGen1,
			input2:   exampleObjDifferentTitle,
			expected: false,
		},
	}
	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, Compare(tt.input1, tt.input2))
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

// Never lock in tests
type fakeServerLock struct {
}

func (f *fakeServerLock) LockExecuteAndRelease(ctx context.Context, actionName string, duration time.Duration, fn func(ctx context.Context)) error {
	fn(ctx)
	return nil
}
