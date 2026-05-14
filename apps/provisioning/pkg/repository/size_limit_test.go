package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestSizeLimitedReaderWriter_Read(t *testing.T) {
	const path = "dashboards/x.json"

	tests := []struct {
		name        string
		maxBytes    int64
		dataSize    int
		wantTooBig  bool
		wantWrapped bool
	}{
		{name: "under limit", maxBytes: 1024, dataSize: 512, wantWrapped: true},
		{name: "exactly at limit", maxBytes: 1024, dataSize: 1024, wantWrapped: true},
		{name: "over limit", maxBytes: 1024, dataSize: 2048, wantWrapped: true, wantTooBig: true},
		{name: "zero disables limit", maxBytes: 0, dataSize: 10 * 1024 * 1024},
		{name: "negative disables limit", maxBytes: -1, dataSize: 10 * 1024 * 1024},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			inner := NewMockReaderWriter(t)
			inner.EXPECT().Read(mock.Anything, path, "").Return(&FileInfo{
				Path: path,
				Data: make([]byte, tc.dataSize),
			}, nil)

			rw := NewSizeLimitedReaderWriter(inner, tc.maxBytes)
			if !tc.wantWrapped {
				assert.Same(t, ReaderWriter(inner), rw, "expected wrapper to no-op when maxBytes <= 0")
			}

			_, err := rw.Read(context.Background(), path, "")
			if tc.wantTooBig {
				require.Error(t, err)
				assert.True(t, apierrors.IsRequestEntityTooLargeError(err), "expected 413, got %v", err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// versionedReaderWriter is the minimal interface a sync-capable repository
// implements. The wrapper must preserve Versioned so syncer.Sync's
// repo.(repository.Versioned) assertion still succeeds.
type versionedReaderWriter interface {
	ReaderWriter
	Versioned
}

func TestSizeLimitedReaderWriter_PreservesVersioned(t *testing.T) {
	inner := struct {
		*MockReaderWriter
		*MockVersioned
	}{MockReaderWriter: NewMockReaderWriter(t), MockVersioned: NewMockVersioned(t)}

	rw := NewSizeLimitedReaderWriter(inner, 1024)

	_, isVersioned := rw.(Versioned)
	assert.True(t, isVersioned, "wrapped repository must still satisfy Versioned")

	_, isCombined := rw.(versionedReaderWriter)
	assert.True(t, isCombined, "wrapped repository must still satisfy ReaderWriter+Versioned")
}
