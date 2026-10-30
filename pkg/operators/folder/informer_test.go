package folder

import (
	"context"
	"errors"
	"iter"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

type fakeKeys struct {
	rv   int64
	keys []keysapi.Key
	// failAt makes the sequence fail instead of yielding keys[failAt]; negative means never.
	failAt int
}

func (f fakeKeys) ListKeys(context.Context) (int64, iter.Seq2[keysapi.Key, error]) {
	return f.rv, func(yield func(keysapi.Key, error) bool) {
		for i, k := range f.keys {
			if i == f.failAt {
				yield(keysapi.Key{}, errors.New("page failed"))
				return
			}
			if !yield(k, nil) {
				return
			}
		}
	}
}

func TestListFolderKeys(t *testing.T) {
	keys := []keysapi.Key{
		{Namespace: "stacks-1", Name: "a", ResourceVersion: "10", Folder: "parent"},
		{Namespace: "stacks-2", Name: "b", ResourceVersion: "20"},
	}

	t.Run("projects keys to minimal objects", func(t *testing.T) {
		objs, rv, err := listFolderKeys(t.Context(), fakeKeys{rv: 100, keys: keys, failAt: -1})
		require.NoError(t, err)
		require.Equal(t, int64(100), rv)
		require.Equal(t, []runtime.Object{
			&metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-1", Name: "a", ResourceVersion: "10"}},
			&metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-2", Name: "b", ResourceVersion: "20"}},
		}, objs)
	})

	t.Run("an empty snapshot is not an error", func(t *testing.T) {
		objs, rv, err := listFolderKeys(t.Context(), fakeKeys{rv: 7, failAt: -1})
		require.NoError(t, err)
		require.Equal(t, int64(7), rv)
		require.Empty(t, objs)
	})

	t.Run("a failure partway discards the snapshot", func(t *testing.T) {
		objs, rv, err := listFolderKeys(t.Context(), fakeKeys{rv: 100, keys: keys, failAt: 1})
		require.ErrorContains(t, err, "page failed")
		require.Nil(t, objs, "a partial snapshot would report the missing folders as deleted")
		require.Zero(t, rv)
	})
}
