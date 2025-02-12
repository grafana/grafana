package store

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

// GetUserVisibleNamespaces returns the folders that are visible to the user
func (st DBstore) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error) {
	folders, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{
		OrgID:        orgID,
		WithFullpath: true,
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}

	namespaceMap := make(map[string]*folder.Folder)
	for _, f := range folders {
		namespaceMap[f.UID] = f
	}
	return namespaceMap, nil
}

// GetNamespaceByUID is a handler for retrieving a namespace by its UID. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	f, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{OrgID: orgID, UIDs: []string{uid}, WithFullpath: true, SignedInUser: user})
	if err != nil {
		return nil, err
	}
	if len(f) == 0 {
		return nil, dashboards.ErrFolderAccessDenied
	}
	return f[0], nil
}

// GetNamespaceInRootByTitle gets namespace by its title in the root folder.
func (st DBstore) GetNamespaceInRootByTitle(ctx context.Context, title string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	folder, err := st.FolderService.Get(ctx, &folder.GetFolderQuery{
		OrgID:        orgID,
		Title:        util.Pointer(title),
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}

	return folder, nil
}

// GetOrCreateNamespaceInRootByTitle gets or creates a namespace by title in the _root_ folder.
func (st DBstore) GetOrCreateNamespaceInRootByTitle(ctx context.Context, title string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	var f *folder.Folder
	var err error

	f, err = st.GetNamespaceInRootByTitle(ctx, title, orgID, user)
	if err != nil && !errors.Is(err, dashboards.ErrFolderNotFound) {
		return nil, err
	}

	if f == nil {
		cmd := &folder.CreateFolderCommand{
			OrgID:        orgID,
			Title:        title,
			SignedInUser: user,
		}
		f, err = st.FolderService.Create(ctx, cmd)
		if err != nil {
			return nil, err
		}
	}

	return f, nil
}
