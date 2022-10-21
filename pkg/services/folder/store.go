package folder

import "context"

// Store is the interface which a folder store must implement.
type Store interface {
	// Create creates a folder and returns the newly-created folder.
	Create(ctx context.Context, cmd *CreateFolderCommand) (*Folder, error)

	// Delete deletes a folder from the folder store.
	Delete(ctx context.Context, uid string, orgID int64) error

	// Update updates the given folder's UID, Title, and Description.
	// Use Move to change a dashboard's parent ID.
	Update(ctx context.Context, cmd *UpdateFolderCommand) (*Folder, error)

	// Move changes the given folder's parent folder uid and applies any necessary permissions changes.
	Move(ctx context.Context, cmd *MoveFolderCommand) (*Folder, error)

	// Get returns a folder.
	Get(ctx context.Context, cmd *GetFolderCommand) (*Folder, error)

	// GetParent returns the parent folder of the given folder.
	GetParent(ctx context.Context, uid string, orgID int64) (*Folder, error)

	// GetParents returns an ordered list of parent folder of the given folder.
	GetParents(ctx context.Context, uid string, orgID int64) ([]*Folder, error)

	// GetChildren returns the set of immediate children folders (depth=1) of the
	// given folder. Use GetDescendents to get all descendents of a given parent
	// folder.
	GetChildren(ctx context.Context, uid string, orgID, limit, page int64) ([]*Folder, error)

	// GetDescendents returns a map of all descendents of the given parent
	// folder for the selected depth. The map keys are the parent uid and the
	// values are lists of immediate child folders for that parent.
	GetDescendents(ctx context.Context, uid string, orgID, limit, page int64) (map[string][]*Folder, error)
}
