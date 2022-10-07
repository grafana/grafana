package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

type Service struct {
	folderService dashboards.FolderService
}

func ProvideService(folderService dashboards.FolderService) folder.Service {
	return &Service{folderService: folderService}
}

func (s *Service) GetFolders(ctx context.Context, user *user.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
	return s.folderService.GetFolders(ctx, user, orgID, limit, page)
}

func (s *Service) GetFolderByID(ctx context.Context, user *user.SignedInUser, id int64, orgID int64) (*models.Folder, error) {
	return s.folderService.GetFolderByID(ctx, user, id, orgID)
}

func (s *Service) GetFolderByUID(ctx context.Context, user *user.SignedInUser, orgID int64, uid string) (*models.Folder, error) {
	return s.folderService.GetFolderByUID(ctx, user, orgID, uid)
}

func (s *Service) GetFolderByTitle(ctx context.Context, user *user.SignedInUser, orgID int64, title string) (*models.Folder, error) {
	return s.folderService.GetFolderByTitle(ctx, user, orgID, title)
}

func (s *Service) CreateFolder(ctx context.Context, user *user.SignedInUser, orgID int64, title, uid string) (*models.Folder, error) {
	return s.folderService.GetFolderByTitle(ctx, user, orgID, title)
}

func (s *Service) UpdateFolder(ctx context.Context, user *user.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) error {
	return s.folderService.UpdateFolder(ctx, user, orgID, existingUid, cmd)
}

func (s *Service) DeleteFolder(ctx context.Context, user *user.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*models.Folder, error) {
	return s.folderService.DeleteFolder(ctx, user, orgID, uid, forceDeleteRules)
}

func (s *Service) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return s.folderService.MakeUserAdmin(ctx, orgID, userID, folderID, setViewAndEditPermissions)
}
