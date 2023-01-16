package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/folder"
)

// store is the interface which a folder store must implement.
type store interface {
	// Create creates a folder and returns the newly-created folder.
	Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error)

	// Delete deletes a folder from the folder store.
	Delete(ctx context.Context, uid string, orgID int64) error

	// Update updates the given folder's UID, Title, and Description.
	// Use Move to change a dashboard's parent ID.
	Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error)

	// Get returns a folder.
	Get(ctx context.Context, cmd folder.GetFolderQuery) (*folder.Folder, error)

	// GetParents returns an ordered list of parent folder of the given folder.
	GetParents(ctx context.Context, cmd folder.GetParentsQuery) ([]*folder.Folder, error)

	// GetChildren returns the set of immediate children folders (depth=1) of the
	// given folder.
	GetChildren(ctx context.Context, cmd folder.GetChildrenQuery) ([]*folder.Folder, error)

	// GetHeight returns the height of the folder tree. When parentUID is set, the function would
	// verify in the meanwhile that parentUID is not present in the subtree of the folder with the given UID.
	GetHeight(ctx context.Context, foldrUID string, orgID int64, parentUID *string) (int, error)
}
