package foldertest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

type FakeService struct {
	ExpectedFolders []*models.Folder
	ExpectedFolder  *models.Folder
	ExpectedError   error
}

var _ folder.Service = (*FakeService)(nil)

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
func (s *FakeService) CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*models.Folder, error) {
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

func (s *FakeService) GetParents(ctx context.Context, orgID int64, folderUID string) ([]*folder.Folder, error) {
	return modelsToFolders(s.ExpectedFolders), s.ExpectedError
}

func (s *FakeService) GetTree(ctx context.Context, orgID int64, folderUID string, depth int64) (map[string][]*folder.Folder, error) {
	ret := make(map[string][]*folder.Folder)
	ret[folderUID] = modelsToFolders(s.ExpectedFolders)
	return ret, s.ExpectedError
}

// temporary helper until all Folder service methods are updated to use
// folder.Folder instead of model.Folder
func modelsToFolders(m []*models.Folder) []*folder.Folder {
	if m == nil {
		return nil
	}
	ret := make([]*folder.Folder, len(m))
	for i, f := range m {
		ret[i] = &folder.Folder{
			ID:          f.Id,
			UID:         f.Uid,
			Title:       f.Title,
			Description: "", // model.Folder does not have a description
			URL:         f.Url,
			Created:     f.Created,
			CreatedBy:   f.CreatedBy,
			Updated:     f.Updated,
			UpdatedBy:   f.UpdatedBy,
			HasACL:      f.HasACL,
		}
	}
	return ret
}
