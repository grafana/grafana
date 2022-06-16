package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

//go:generate mockery --name FolderService --structname MockFolderService --inpackage --filename folder_service_mock.go
// FolderService is a service for operating on folders.
type FolderService interface {
	GetFolders(ctx context.Context, user *models.SignedInUser, orgID int64, limit int64, page int64) ([]*Folder, error)
	GetFolderByID(ctx context.Context, user *models.SignedInUser, id int64, orgID int64) (*Folder, error)
	GetFolderByUID(ctx context.Context, user *models.SignedInUser, orgID int64, uid string) (*Folder, error)
	GetFolderByTitle(ctx context.Context, user *models.SignedInUser, orgID int64, title string) (*Folder, error)
	CreateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, title, uid string) (*Folder, error)
	UpdateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, existingUid string, cmd *UpdateFolderCommand) error
	DeleteFolder(ctx context.Context, user *models.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*Folder, error)
	MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error
}
