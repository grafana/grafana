package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/folder"
)

type getFoldersQuery struct {
	folder.GetFoldersQuery
	ancestorUIDs []string
}

func NewGetFoldersQuery(q folder.GetFoldersQuery) getFoldersQuery {
	return getFoldersQuery{
		GetFoldersQuery: q,
		ancestorUIDs:    []string{},
	}
}

// store is the interface which a folder store must implement.
type store interface {
	// Create creates a folder and returns the newly-created folder.
	Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error)

	// Delete folders with the specified UIDs and orgID from the folder store.
	Delete(ctx context.Context, UIDs []string, orgID int64) error

	// Update updates the given folder's UID, Title, and Description (update mode).
	// If the NewParentUID field is not nil, it updates also the parent UID (move mode).
	// If it's a non empty string, it moves the folder under the folder with the specific UID
	// otherwise, it moves the folder under the root folder (parent_uid column is set to NULL).
	Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error)

	// Get returns a folder.
	Get(ctx context.Context, q folder.GetFolderQuery) (*folder.Folder, error)

	// GetParents returns an ordered list of parent folder of the given folder.
	GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error)

	// GetChildren returns the set of immediate children folders (depth=1) of the
	// given folder.
	GetChildren(ctx context.Context, q folder.GetChildrenQuery) ([]*folder.Folder, error)

	// GetHeight returns the height of the folder tree. When parentUID is set, the function would
	// verify in the meanwhile that parentUID is not present in the subtree of the folder with the given UID.
	GetHeight(ctx context.Context, foldrUID string, orgID int64, parentUID *string) (int, error)

	// GetFolders returns folders with given uids
	GetFolders(ctx context.Context, q getFoldersQuery) ([]*folder.Folder, error)
	// GetDescendants returns all descendants of a folder
	GetDescendants(ctx context.Context, orgID int64, anchestor_uid string) ([]*folder.Folder, error)
}
