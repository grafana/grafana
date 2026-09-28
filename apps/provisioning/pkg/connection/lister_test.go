package connection

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type mockStorageLister struct {
	pages [][]provisioning.Connection
	err   error
	calls int
	// wrongObject makes List return a non-ConnectionList runtime.Object.
	wrongObject bool
}

func (m *mockStorageLister) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.wrongObject {
		return &provisioning.RepositoryList{}, nil
	}

	if m.calls >= len(m.pages) {
		return &provisioning.ConnectionList{Items: []provisioning.Connection{}}, nil
	}

	page := m.pages[m.calls]
	m.calls++

	list := &provisioning.ConnectionList{Items: page}
	if m.calls < len(m.pages) {
		list.Continue = "next"
	}

	return list, nil
}

func TestStorageLister_List(t *testing.T) {
	t.Run("returns empty list when no connections", func(t *testing.T) {
		store := &mockStorageLister{
			pages: [][]provisioning.Connection{{}},
		}
		lister := NewStorageLister(store)

		conns, err := lister.List(context.Background())

		require.NoError(t, err)
		assert.Empty(t, conns)
	})

	t.Run("returns all connections from single page", func(t *testing.T) {
		store := &mockStorageLister{
			pages: [][]provisioning.Connection{
				{
					{ObjectMeta: metav1.ObjectMeta{Name: "conn1"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "conn2"}},
				},
			},
		}
		lister := NewStorageLister(store)

		conns, err := lister.List(context.Background())

		require.NoError(t, err)
		assert.Len(t, conns, 2)
		assert.Equal(t, "conn1", conns[0].Name)
		assert.Equal(t, "conn2", conns[1].Name)
	})

	t.Run("paginates through multiple pages", func(t *testing.T) {
		store := &mockStorageLister{
			pages: [][]provisioning.Connection{
				{
					{ObjectMeta: metav1.ObjectMeta{Name: "conn1"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "conn2"}},
				},
				{
					{ObjectMeta: metav1.ObjectMeta{Name: "conn3"}},
				},
			},
		}
		lister := NewStorageLister(store)

		conns, err := lister.List(context.Background())

		require.NoError(t, err)
		assert.Len(t, conns, 3)
		assert.Equal(t, "conn1", conns[0].Name)
		assert.Equal(t, "conn2", conns[1].Name)
		assert.Equal(t, "conn3", conns[2].Name)
		assert.Equal(t, 2, store.calls)
	})

	t.Run("returns error from storage", func(t *testing.T) {
		expectedErr := errors.New("storage error")
		store := &mockStorageLister{
			err: expectedErr,
		}
		lister := NewStorageLister(store)

		conns, err := lister.List(context.Background())

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, conns)
	})

	t.Run("returns error on unexpected object type", func(t *testing.T) {
		store := &mockStorageLister{
			wrongObject: true,
		}
		lister := NewStorageLister(store)

		conns, err := lister.List(context.Background())

		require.Error(t, err)
		assert.Nil(t, conns)
	})
}
