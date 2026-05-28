package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

// mockReadWriterWithURLs implements ReaderWriter and RepositoryWithURLs.
// It is created manually here to avoid the ambiguous implementation of the
// ReaderWriter and RepositoryWithURLs mocks, as they both implement Config and Test.
type mockReadWriterWithURLs struct {
	ReaderWriter
	RepositoryWithURLs
}

func (m mockReadWriterWithURLs) Config() *provisioning.Repository {
	return m.ReaderWriter.Config()
}

func (m mockReadWriterWithURLs) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return m.ReaderWriter.Test(ctx)
}

func TestSizeLimitedReaderWriter_PreservesRepositoryWithURLs(t *testing.T) {
	inner := mockReadWriterWithURLs{
		ReaderWriter:       NewMockReaderWriter(t),
		RepositoryWithURLs: NewMockRepositoryWithURLs(t),
	}

	rw := NewSizeLimitedReaderWriter(inner, 1024)

	_, hasURLs := rw.(RepositoryWithURLs)
	assert.True(t, hasURLs, "wrapped repository must still satisfy RepositoryWithURLs")

	_, isVersioned := rw.(Versioned)
	assert.False(t, isVersioned, "should not satisfy Versioned when inner does not")
}

// mockReadWriterWithURLs implements ReaderWriter, Versioned and RepositoryWithURLs.
// It is created manually here to avoid the ambiguous implementation of the
// ReaderWriter and RepositoryWithURLs mocks, as they both implement Config and Test.
type mockReadWriterVersionedWithURLs struct {
	Versioned
	ReaderWriter
	RepositoryWithURLs
}

func (m mockReadWriterVersionedWithURLs) Config() *provisioning.Repository {
	return m.ReaderWriter.Config()
}

func (m mockReadWriterVersionedWithURLs) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return m.ReaderWriter.Test(ctx)
}

func TestSizeLimitedReaderWriter_PreservesAllInterfaces(t *testing.T) {
	inner := mockReadWriterVersionedWithURLs{
		Versioned:          NewMockVersioned(t),
		ReaderWriter:       NewMockReaderWriter(t),
		RepositoryWithURLs: NewMockRepositoryWithURLs(t),
	}

	rw := NewSizeLimitedReaderWriter(inner, 1024)

	_, isVersioned := rw.(Versioned)
	assert.True(t, isVersioned, "wrapped repository must still satisfy Versioned")

	_, hasURLs := rw.(RepositoryWithURLs)
	assert.True(t, hasURLs, "wrapped repository must still satisfy RepositoryWithURLs")
}

func TestSizeLimitedReaderWriter_NoOptionalInterfaces(t *testing.T) {
	inner := NewMockReaderWriter(t)

	rw := NewSizeLimitedReaderWriter(inner, 1024)

	_, isVersioned := rw.(Versioned)
	assert.False(t, isVersioned, "should not satisfy Versioned when inner does not")

	_, hasURLs := rw.(RepositoryWithURLs)
	assert.False(t, hasURLs, "should not satisfy RepositoryWithURLs when inner does not")
}
