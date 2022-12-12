package foldertest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

type FakeService struct {
	ExpectedFolders []*models.Folder
	ExpectedFolder  *folder.Folder
	ExpectedError   error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

var _ folder.Service = (*FakeService)(nil)

func (s *FakeService) GetFolders(ctx context.Context, user *user.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
	return s.ExpectedFolders, s.ExpectedError
}

func (s *FakeService) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) Get(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) DeleteFolder(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	return s.ExpectedError
}
func (s *FakeService) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return s.ExpectedError
}

func (s *FakeService) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
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
			Created:     f.Created,
			Updated:     f.Updated,
			//UpdatedBy:   f.UpdatedBy,
		}
	}
	return ret
}
