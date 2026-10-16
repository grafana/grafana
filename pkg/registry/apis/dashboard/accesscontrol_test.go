package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

// serviceIdentityFolderService records whether GetParents ran under a service identity.
type serviceIdentityFolderService struct {
	*foldertest.FakeService
	getParentsUsedServiceIdentity bool
}

func (s *serviceIdentityFolderService) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	s.getParentsUsedServiceIdentity = identity.IsServiceIdentity(ctx)
	return s.FakeService.GetParents(ctx, q)
}

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

	t.Run("folder UID with embedded -- resolves to full folder UID", func(t *testing.T) {
		scopes, err := resolver.Resolve(context.Background(), 1, "variables:uid:region--team--prod")
		require.NoError(t, err)
		require.Contains(t, scopes, ScopeVariablesProvider.GetResourceScopeUID("region--team--prod"))
		require.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("team--prod"))
		require.NotContains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("prod"))
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

	t.Run("walks ancestors under service identity", func(t *testing.T) {
		svc := &serviceIdentityFolderService{FakeService: foldertest.NewFakeService()}
		svc.ExpectedFolders = []*folder.Folder{{UID: "parent", OrgID: 1}}
		_, res := VariableUIDScopeResolver(svc)

		scopes, err := res.Resolve(context.Background(), 1, "variables:uid:region--child")
		require.NoError(t, err)
		require.True(t, svc.getParentsUsedServiceIdentity)
		require.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("parent"))
		require.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("child"))
		require.Contains(t, scopes, ScopeVariablesProvider.GetResourceScopeUID("region--child"))
	})
}
