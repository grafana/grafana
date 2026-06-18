package libraryelements

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestPanelFolderContext(t *testing.T) {
	elements := []model.LibraryElementDTO{
		{UID: "panel-1", FolderUID: "folder-a"},
		{UID: "panel-2", FolderUID: ""}, // general folder
	}
	ctx := withPanelFolders(context.Background(), elements)

	t.Run("returns the recorded folder for a known panel", func(t *testing.T) {
		f, ok := panelFolderFromContext(ctx, "panel-1")
		assert.True(t, ok)
		assert.Equal(t, "folder-a", f)
	})

	t.Run("records the general (empty) folder", func(t *testing.T) {
		f, ok := panelFolderFromContext(ctx, "panel-2")
		assert.True(t, ok)
		assert.Equal(t, "", f)
	})

	t.Run("reports miss for an unknown panel", func(t *testing.T) {
		_, ok := panelFolderFromContext(ctx, "panel-x")
		assert.False(t, ok)
	})

	t.Run("reports miss when no map is present", func(t *testing.T) {
		_, ok := panelFolderFromContext(context.Background(), "panel-1")
		assert.False(t, ok)
	})
}

// TestLibraryPanelUIDScopeResolver_UsesContextFolder verifies that when the
// panel's folder is provided via the request context, the resolver derives the
// folder scope from it and does NOT perform the per-panel database lookup. The
// service is constructed without a SQLStore, so any fallback to
// getLibraryElementByUid would panic — proving the lookup is skipped.
func TestLibraryPanelUIDScopeResolver_UsesContextFolder(t *testing.T) {
	folderSvc := foldertest.NewFakeService() // GetParents returns no ancestors
	svc := &LibraryElementService{
		folderService: folderSvc,
		treeCache:     newFolderTreeCache(folderSvc),
		log:           log.NewNopLogger(),
		// deliberately no SQLStore: getLibraryElementByUid must not be reached
	}
	_, resolver := LibraryPanelUIDScopeResolver(svc, folderSvc)

	usr := &user.SignedInUser{UserID: 1, OrgID: 1}
	ctx := identity.WithRequester(context.Background(), usr)
	ctx = withPanelFolders(ctx, []model.LibraryElementDTO{{UID: "panel-1", FolderUID: "folder-a"}})

	scopes, err := resolver.Resolve(ctx, 1, ScopeLibraryPanelsProvider.GetResourceScopeUID("panel-1"))
	require.NoError(t, err)

	assert.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a"),
		"resolved scopes should include the panel's folder scope")
	assert.Contains(t, scopes, ScopeLibraryPanelsProvider.GetResourceScopeUID("panel-1"),
		"resolved scopes should include the panel scope")
}
