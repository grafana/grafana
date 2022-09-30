package persistentcollection

import (
	"context"
	"fmt"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/require"
)

type item struct {
	Name string `json:"name"`
	Val  int64  `json:"val"`
}

func TestLocalFSPersistentCollection(t *testing.T) {
	orgID := int64(1)
	ctx := context.Background()
	dir := path.Join(os.TempDir(), "persistent-collection-test")
	defer func() {
		if err := os.RemoveAll(dir); err != nil {
			fmt.Printf("Failed to remove temporary directory %q: %s\n", dir, err.Error())
		}
	}()

	coll := NewLocalFSPersistentCollection[*item]("test", dir, 1)

	firstInserted := &item{
		Name: "test",
		Val:  10,
	}
	err := coll.Insert(ctx, orgID, firstInserted)
	require.NoError(t, err)

	err = coll.Insert(ctx, orgID, &item{
		Name: "test",
		Val:  20,
	})
	require.NoError(t, err)

	err = coll.Insert(ctx, orgID, &item{
		Name: "test",
		Val:  30,
	})
	require.NoError(t, err)

	updatedCount, err := coll.Update(ctx, orgID, func(i *item) (bool, *item, error) {
		if i.Val == 20 {
			return true, &item{Val: 25, Name: "test"}, nil
		}
		return false, nil, nil
	})
	require.Equal(t, 1, updatedCount)
	require.NoError(t, err)

	deletedCount, err := coll.Delete(ctx, orgID, func(i *item) (bool, error) {
		if i.Val == 30 {
			return true, nil
		}
		return false, nil
	})
	require.Equal(t, 1, deletedCount)
	require.NoError(t, err)

	firstFound, err := coll.FindFirst(ctx, orgID, func(i *item) (bool, error) {
		if i.Name == "test" {
			return true, nil
		}

		return false, nil
	})
	require.NoError(t, err)
	require.Equal(t, firstInserted, firstFound)

	all, err := coll.Find(ctx, orgID, func(i *item) (bool, error) { return true, nil })
	require.NoError(t, err)
	require.Equal(t, []*item{
		{
			Name: "test",
			Val:  10,
		},
		{
			Name: "test",
			Val:  25,
		},
	}, all)
}
