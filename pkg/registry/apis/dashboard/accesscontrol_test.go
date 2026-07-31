package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

func TestVariableUIDScopeResolver(t *testing.T) {
	folderSvc := foldertest.NewFakeService()
	prefix, resolver := VariableUIDScopeResolver(folderSvc)

	require.Equal(t, "variables:uid:", prefix)

	t.Run("rejects invalid prefix", func(t *testing.T) {
		_, err := resolver.Resolve(context.Background(), 1, "dashboards:uid:x")
		require.ErrorIs(t, err, accesscontrol.ErrInvalidScope)
	})

	t.Run("global variable resolves to general folder", func(t *testing.T) {
		scopes, err := resolver.Resolve(context.Background(), 1, "variables:uid:region")
		require.NoError(t, err)
		require.Contains(t, scopes, ScopeVariablesProvider.GetResourceScopeUID("region"))
		require.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID))
	})

	t.Run("folder-scoped variable resolves to parent folder", func(t *testing.T) {
		scopes, err := resolver.Resolve(context.Background(), 1, "variables:uid:region--folder-a")
		require.NoError(t, err)
		require.Contains(t, scopes, ScopeVariablesProvider.GetResourceScopeUID("region--folder-a"))
		require.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a"))
	})

	t.Run("missing parent folder still returns direct scopes", func(t *testing.T) {
		missingSvc := foldertest.NewFakeService()
		missingSvc.ExpectedError = folder.ErrFolderNotFound
		_, missingResolver := VariableUIDScopeResolver(missingSvc)

		scopes, err := missingResolver.Resolve(context.Background(), 1, "variables:uid:region--gone")
		require.NoError(t, err)
		require.Equal(t, []string{
			folder.ScopeFoldersProvider.GetResourceScopeUID("gone"),
			ScopeVariablesProvider.GetResourceScopeUID("region--gone"),
		}, scopes)
	})
}
