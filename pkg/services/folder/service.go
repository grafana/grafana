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
	DeleteFolder(ctx context.Context, user *user.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*models.Folder, error)
	MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error

	// * New and Improved FolderService methods; not yet implemented *
	//
	// GetParents returns an ordered list of parent folders for the given
	// folder, starting with the root node and ending with the requested child
	// node.
	// GetParents(ctx context.Context, orgID int64, folderUID string) ([]*Folder, error)

	// GetTree returns an map containing all child folders starting from the
	// given parent folder UID and descending to the requested depth. Use the
	// sentinel value -1 to return all child folders.
	//
	// The map keys are folder uids and the values are the list of child folders
	// for that parent.
	// GetTree(ctx context.Context, orgID int64, folderUID string, depth int64) (map[string][]*Folder, error)
}
