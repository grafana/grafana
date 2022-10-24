package foldertest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

type FakeService struct {
	ExpectedFolders []*models.Folder
	ExpectedFolder  *models.Folder
	ExpectedError   error
}

func (s *FakeService) GetFolders(ctx context.Context, user *user.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
	return s.ExpectedFolders, s.ExpectedError
}
func (s *FakeService) GetFolderByID(ctx context.Context, user *user.SignedInUser, id int64, orgID int64) (*models.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) GetFolderByUID(ctx context.Context, user *user.SignedInUser, orgID int64, uid string) (*models.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) GetFolderByTitle(ctx context.Context, user *user.SignedInUser, orgID int64, title string) (*models.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) CreateFolder(ctx context.Context, user *user.SignedInUser, orgID int64, title, uid string) (*models.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) UpdateFolder(ctx context.Context, user *user.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) error {
	cmd.Result = s.ExpectedFolder
	return s.ExpectedError
}
func (s *FakeService) DeleteFolder(ctx context.Context, user *user.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*models.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return s.ExpectedError
}
