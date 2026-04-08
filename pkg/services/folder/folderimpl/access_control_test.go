package folderimpl

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/stretchr/testify/require"
)

func noOpLookup(ctx context.Context, orgID int64, id int64) (string, error) {
	return fmt.Sprintf("%d", id), nil
}
func TestNewFolderIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := folder.NewFolderIDScopeResolver(noOpLookup, foldertest.NewFakeService())
		require.Equal(t, "folders:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := folder.NewFolderIDScopeResolver(noOpLookup, foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert id 0 to general uid scope", func(t *testing.T) {
		var (
			orgId       = rand.Int63()
			scope       = "folders:id:0"
			_, resolver = folder.NewFolderIDScopeResolver(noOpLookup, foldertest.NewFakeService())
		)

		resolved, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Len(t, resolved, 1)
		require.Equal(t, "folders:uid:general", resolved[0])
	})

	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		_, resolver := folder.NewFolderIDScopeResolver(noOpLookup, foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		_, resolver := folder.NewFolderIDScopeResolver(func(ctx context.Context, orgID int64, id int64) (string, error) {
			return "", folder.ErrFolderNotFound
		}, foldertest.NewFakeService())

		orgId := rand.Int63()
		scope := "folders:id:10"
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, folder.ErrFolderNotFound)
		require.Nil(t, resolvedScopes)
	})
}
