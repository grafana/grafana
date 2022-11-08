package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

type Service interface {
	GetFolders(ctx context.Context, user *user.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error)
	GetFolderByID(ctx context.Context, user *user.SignedInUser, id int64, orgID int64) (*models.Folder, error)
	GetFolderByUID(ctx context.Context, user *user.SignedInUser, orgID int64, uid string) (*models.Folder, error)
	GetFolderByTitle(ctx context.Context, user *user.SignedInUser, orgID int64, title string) (*models.Folder, error)
	CreateFolder(ctx context.Context, user *user.SignedInUser, orgID int64, title, uid string) (*models.Folder, error)
	UpdateFolder(ctx context.Context, user *user.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) error
	DeleteFolder(ctx context.Context, cmd *DeleteFolderCommand) (*Folder, error)
	MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error
}

// TODO: remove when nested folder refactor is done.
func ConvertModelFolderToFolder(folder *models.Folder, orgId int64) *Folder {
	if folder == nil {
		return nil
	}
	return &Folder{
		ID:      folder.Id,
		OrgID:   orgId,
		UID:     folder.Uid,
		URL:     folder.Url,
		Title:   folder.Title,
		Created: folder.Created,
		Updated: folder.Updated,
	}
}

// NestedFolderService is the temporary interface definition for the folder
// Service which includes any new or alternate methods. These will be collapsed
// into a single service when the nested folder implementation is rolled out.
// Note that the commands in this service use models from this package, while
// the legacy FolderService uses models from the models package.
type NestedFolderService interface {
	// Create creates a new folder.
	Create(ctx context.Context, cmd *CreateFolderCommand) (*Folder, error)

	// Update is used to update a folder's UID, Title and Description. To change
	// a folder's parent folder, use Move.
	Update(ctx context.Context, cmd *UpdateFolderCommand) (*Folder, error)

	// Move changes a folder's parent folder to the requested new parent.
	Move(ctx context.Context, cmd *MoveFolderCommand) (*Folder, error)

	// Delete deletes a folder. This will return an error if there are any
	// dashboards in the folder.
	Delete(ctx context.Context, cmd *DeleteFolderCommand) (*Folder, error)

	// GetFolder takes a GetFolderCommand and returns a folder matching the
	// request. One of ID, UID, or Title must be included. If multiple values
	// are included in the request, Grafana will select one in order of
	// specificity (ID, UID, Title).
	Get(ctx context.Context, cmd *GetFolderQuery) (*Folder, error)

	// GetParents returns an ordered list of parent folders for the given
	// folder, starting with the root node and ending with the requested child
	// node.
	GetParents(ctx context.Context, cmd *GetParentsQuery) ([]*Folder, error)

	// GetTree returns an map containing all child folders starting from the
	// given parent folder UID and descending to the requested depth. Use the
	// sentinel value -1 to return all child folders.
	//
	// The map keys are folder uids and the values are the list of child folders
	// for that parent.
	GetTree(ctx context.Context, cmd *GetTreeQuery) ([]*Folder, error)
}
