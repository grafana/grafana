package rest

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestSetDualWritingMode(t *testing.T) {
	type testCase struct {
		name            string
		kvStore         *fakeNamespacedKV
		desiredMode     DualWriterMode
		expectedMode    DualWriterMode
		skipDataSync    bool
		serverLockError error
	}
	tests :=
		[]testCase{
			{
				name:         "should return a mode 2 dual writer when mode 2 is set as the desired mode",
				kvStore:      &fakeNamespacedKV{data: map[string]string{"playlist.grafana.app/playlists": "2"}, namespace: "storage.dualwriting"},
				desiredMode:  Mode2,
				expectedMode: Mode2,
			},
			{
				name:         "should return a mode 1 dual writer when mode 1 is set as the desired mode",
				kvStore:      &fakeNamespacedKV{data: map[string]string{"playlist.grafana.app/playlists": "2"}, namespace: "storage.dualwriting"},
				desiredMode:  Mode1,
				expectedMode: Mode1,
			},
			{
				name:         "should return mode 3 as desired mode when current mode is > 3",
				kvStore:      &fakeNamespacedKV{data: map[string]string{"playlist.grafana.app/playlists": "5"}, namespace: "storage.dualwriting"},
				desiredMode:  Mode3,
				expectedMode: Mode3,
			},
			{
				name:         "should return mode 3 as desired mode when current mode is 2",
				kvStore:      &fakeNamespacedKV{data: map[string]string{"playlist.grafana.app/playlists": "2"}, namespace: "storage.dualwriting"},
				desiredMode:  Mode3,
				expectedMode: Mode3,
			},
			{
				name:         "should default to mode 0 if there is no desired mode",
				kvStore:      &fakeNamespacedKV{data: map[string]string{}, namespace: "storage.dualwriting"},
				desiredMode:  Mode0,
				expectedMode: Mode0,
			},
			{
				name:            "should keep mode2 when trying to go from mode2 to mode3 and the server lock service returns an error",
				kvStore:         &fakeNamespacedKV{data: map[string]string{"playlist.grafana.app/playlists": "2"}, namespace: "storage.dualwriting"},
				desiredMode:     Mode3,
				expectedMode:    Mode2,
				serverLockError: fmt.Errorf("lock already exists"),
			},
			{
				name:         "should keep mode2 when trying to go from mode2 to mode3 and migration is disabled",
				kvStore:      &fakeNamespacedKV{data: map[string]string{"playlist.grafana.app/playlists": "2"}, namespace: "storage.dualwriting"},
				desiredMode:  Mode3,
				expectedMode: Mode2,
				skipDataSync: true,
			},
		}

	for _, tt := range tests {
		l := (Storage)(nil)
		s := (Storage)(nil)

		sm := &mock.Mock{}
		sm.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
		sm.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
		sm.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
		us := storageMock{sm, s}

		lm := &mock.Mock{}
		lm.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
		ls := storageMock{lm, l}

		serverLockSvc := &fakeServerLock{
			err: tt.serverLockError,
		}

		dwMode, err := SetDualWritingMode(context.Background(), tt.kvStore, &SyncerConfig{
			LegacyStorage:     ls,
			Storage:           us,
			Kind:              "playlist.grafana.app/playlists",
			Mode:              tt.desiredMode,
			SkipDataSync:      tt.skipDataSync,
			ServerLockService: serverLockSvc,
			RequestInfo:       &request.RequestInfo{},
			Reg:               p,

			DataSyncerRecordsLimit: 1000,
			DataSyncerInterval:     time.Hour,
		})
		require.NoError(t, err)
		require.Equal(t, tt.expectedMode, dwMode)
	}
}

func TestCompare(t *testing.T) {
	var exampleObjGen1 = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 1}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjGen2 = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjGen3 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "pod", APIVersion: "pods/v0"}, ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
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
			name:     "should return true when objects are the same, but different TypeMeta (kind and apiversion)",
			input1:   exampleObjGen1,
			input2:   exampleObjGen3,
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
			require.Equal(t, tt.expected, Compare(tt.input1, tt.input2))
		})
	}
}

type fakeNamespacedKV struct {
	namespace string
	data      map[string]string
}

func (f *fakeNamespacedKV) Get(ctx context.Context, key string) (string, bool, error) {
	val, ok := f.data[key]
	return val, ok, nil
}

func (f *fakeNamespacedKV) Set(ctx context.Context, key, value string) error {
	f.data[f.namespace+key] = value
	return nil
}

type fakeServerLock struct {
	err error
}

func (f *fakeServerLock) LockExecuteAndRelease(ctx context.Context, actionName string, duration time.Duration, fn func(ctx context.Context)) error {
	if f.err != nil {
		return f.err
	}
	fn(ctx)
	return nil
}
