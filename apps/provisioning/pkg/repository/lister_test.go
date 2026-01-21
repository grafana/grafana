package repository

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
	pages [][]provisioning.Repository
	err   error
	calls int
}

func (m *mockStorageLister) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if m.err != nil {
		return nil, m.err
	}

	if m.calls >= len(m.pages) {
		return &provisioning.RepositoryList{Items: []provisioning.Repository{}}, nil
	}

	page := m.pages[m.calls]
	m.calls++

	list := &provisioning.RepositoryList{Items: page}
	if m.calls < len(m.pages) {
		list.Continue = "next"
	}

	return list, nil
}

func TestStorageLister_List(t *testing.T) {
	t.Run("returns empty list when no repositories", func(t *testing.T) {
		store := &mockStorageLister{
			pages: [][]provisioning.Repository{{}},
		}
		lister := NewStorageLister(store)

		repos, err := lister.List(context.Background())

		require.NoError(t, err)
		assert.Empty(t, repos)
	})

	t.Run("returns all repositories from single page", func(t *testing.T) {
		store := &mockStorageLister{
			pages: [][]provisioning.Repository{
				{
					{ObjectMeta: metav1.ObjectMeta{Name: "repo1"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "repo2"}},
				},
			},
		}
		lister := NewStorageLister(store)

		repos, err := lister.List(context.Background())

		require.NoError(t, err)
		assert.Len(t, repos, 2)
		assert.Equal(t, "repo1", repos[0].Name)
		assert.Equal(t, "repo2", repos[1].Name)
	})

	t.Run("paginates through multiple pages", func(t *testing.T) {
		store := &mockStorageLister{
			pages: [][]provisioning.Repository{
				{
					{ObjectMeta: metav1.ObjectMeta{Name: "repo1"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "repo2"}},
				},
				{
					{ObjectMeta: metav1.ObjectMeta{Name: "repo3"}},
				},
			},
		}
		lister := NewStorageLister(store)

		repos, err := lister.List(context.Background())

		require.NoError(t, err)
		assert.Len(t, repos, 3)
		assert.Equal(t, "repo1", repos[0].Name)
		assert.Equal(t, "repo2", repos[1].Name)
		assert.Equal(t, "repo3", repos[2].Name)
		assert.Equal(t, 2, store.calls)
	})

	t.Run("returns error from storage", func(t *testing.T) {
		expectedErr := errors.New("storage error")
		store := &mockStorageLister{
			err: expectedErr,
		}
		lister := NewStorageLister(store)

		repos, err := lister.List(context.Background())

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, repos)
	})
}
