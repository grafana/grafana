package rest

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	// nolint:depguard
	playlist "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
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
	var examplePlaylistGen1 = &playlist.Playlist{ObjectMeta: metav1.ObjectMeta{Generation: 1}, Spec: playlist.Spec{Title: "Example Playlist"}}
	var examplePlaylistGen2 = &playlist.Playlist{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: playlist.Spec{Title: "Example Playlist"}}
	var anotherPlaylist = &playlist.Playlist{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: playlist.Spec{Title: "Another Playlist"}}

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
			name:     "should return false when objects are different",
			input1:   exampleObj,
			input2:   anotherObj,
			expected: false,
		},
		{
			name:     "should return true when Playlists are the same, but different metadata (generation)",
			input1:   examplePlaylistGen1,
			input2:   examplePlaylistGen2,
			expected: true,
		},
		{
			name:     "should return false when Playlists different",
			input1:   examplePlaylistGen1,
			input2:   anotherPlaylist,
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
