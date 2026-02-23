package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/services/search/model"
)

type LegacyService interface {
	CreateLegacy(ctx context.Context, cmd *CreateFolderCommand) (*Folder, error)
	GetLegacy(ctx context.Context, q *GetFolderQuery) (*Folder, error)
	UpdateLegacy(ctx context.Context, cmd *UpdateFolderCommand) (*Folder, error)
	DeleteLegacy(ctx context.Context, cmd *DeleteFolderCommand) error
	MoveLegacy(ctx context.Context, cmd *MoveFolderCommand) (*Folder, error)
	GetFoldersLegacy(ctx context.Context, q GetFoldersQuery) ([]*Folder, error)
}

// The folder.Service is backed by calls forwarding to an apiserver
type Service interface {
	RegisterService(service RegistryService) error

	Create(ctx context.Context, cmd *CreateFolderCommand) (*Folder, error)

	// GetFolder takes a GetFolderCommand and returns a folder matching the
	// request. One of UID, ID or Title must be included. If multiple values
	// are included in the request, Grafana will select one in order of
	// specificity (UID, ID, Title).
	// When fetching a folder by Title, callers can optionally define a ParentUID.
	// If ParentUID is not set then the folder will be fetched from the root level.
	// If WithFullpath is true it computes also the full path of a folder.
	Get(ctx context.Context, q *GetFolderQuery) (*Folder, error)

	// Update is used to update a folder's UID, Title and Description. To change
	// a folder's parent folder, use Move.
	Update(ctx context.Context, cmd *UpdateFolderCommand) (*Folder, error)

	Delete(ctx context.Context, cmd *DeleteFolderCommand) error

	// Move changes a folder's parent folder to the requested new parent.
	Move(ctx context.Context, cmd *MoveFolderCommand) (*Folder, error)

	// GetFolders returns org folders that are accessible by the signed in user by their UIDs.
	// If WithFullpath is true it computes also the full path of a folder.
	// The full path is a string that contains the titles of all parent folders separated by a slash.
	// If a folder contains a slash in its title, it is escaped with a backslash.
	// If FullpathUIDs is true it computes a string that contains the UIDs of all parent folders separated by slash.
	GetFolders(ctx context.Context, q GetFoldersQuery) ([]*Folder, error)

	// SearchFolders returns a list of folders that match the query.
	SearchFolders(ctx context.Context, q SearchFoldersQuery) (model.HitList, error)

	// GetChildren returns an array containing all child folders.
	GetChildren(ctx context.Context, q *GetChildrenQuery) ([]*FolderReference, error)

	// GetParents returns an array containing add parent folders if nested folders are enabled
	// otherwise it returns an empty array
	GetParents(ctx context.Context, q GetParentsQuery) ([]*Folder, error)

	GetDescendantCounts(ctx context.Context, q *GetDescendantCountsQuery) (DescendantCounts, error)

	CountFoldersInOrg(ctx context.Context, orgID int64) (int64, error)
}
