package foldertest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
)

type FakeService struct {
	ExpectedFoldersRef       []*folder.FolderReference
	ExpectedFolders          []*folder.Folder
	ExpectedFolder           *folder.Folder
	ExpectedHitList          model.HitList
	ExpectedError            error
	ExpectedDescendantCounts map[string]int64
	LastQuery                folder.GetFoldersQuery
	foldersByUID             map[string]*folder.Folder
}

func NewFakeService() *FakeService {
	return &FakeService{
		foldersByUID: make(map[string]*folder.Folder),
	}
}

func (s *FakeService) AddFolder(f *folder.Folder) {
	if s.foldersByUID == nil {
		s.foldersByUID = make(map[string]*folder.Folder)
	}
	s.foldersByUID[f.UID] = f
	s.ExpectedFolders = append(s.ExpectedFolders, f)
}

func (s *FakeService) SetFolders(folders map[string]*folder.Folder) {
	s.foldersByUID = folders
	s.ExpectedFolders = make([]*folder.Folder, 0, len(folders))
	for _, f := range folders {
		s.ExpectedFolders = append(s.ExpectedFolders, f)
	}
}

var _ folder.Service = (*FakeService)(nil)

func (s *FakeService) GetChildren(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	if s.ExpectedError != nil {
		return nil, s.ExpectedError
	}

	if s.ExpectedFoldersRef != nil {
		return s.ExpectedFoldersRef, nil
	}

	var result []*folder.FolderReference
	for _, f := range s.ExpectedFolders {
		if f.OrgID == q.OrgID && f.ParentUID == q.UID {
			result = append(result, f.ToFolderReference())
		}
	}
	return result, nil
}
func (s *FakeService) GetChildrenLegacy(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	return s.ExpectedFoldersRef, s.ExpectedError
}

func (s *FakeService) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	return s.ExpectedFolders, s.ExpectedError
}
func (s *FakeService) GetParentsLegacy(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	return s.ExpectedFolders, s.ExpectedError
}

func (s *FakeService) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) CreateLegacy(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}

func (s *FakeService) Get(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	if q.UID != nil && s.foldersByUID != nil {
		if f, exists := s.foldersByUID[*q.UID]; exists {
			return f, nil
		}
	}
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) GetLegacy(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}

func (s *FakeService) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) UpdateLegacy(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}

func (s *FakeService) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	return s.ExpectedError
}
func (s *FakeService) DeleteLegacy(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	return s.ExpectedError
}

func (s *FakeService) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}
func (s *FakeService) MoveLegacy(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	return s.ExpectedFolder, s.ExpectedError
}

func (s *FakeService) RegisterService(service folder.RegistryService) error {
	return s.ExpectedError
}

func (s *FakeService) GetDescendantCounts(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	return s.ExpectedDescendantCounts, s.ExpectedError
}
func (s *FakeService) GetDescendantCountsLegacy(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	return s.ExpectedDescendantCounts, s.ExpectedError
}

func (s *FakeService) GetFolders(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	if s.foldersByUID != nil && len(q.UIDs) > 0 {
		var result []*folder.Folder
		for _, uid := range q.UIDs {
			if f, exists := s.foldersByUID[uid]; exists {
				result = append(result, f)
			}
		}
		return result, nil
	}

	folders := make([]*folder.Folder, 0, len(s.ExpectedFolders))
	for _, f := range s.ExpectedFolders {
		if f.OrgID == q.OrgID {
			folders = append(folders, f)
		}
	}
	return folders, s.ExpectedError
}

func (s *FakeService) SearchFolders(ctx context.Context, q folder.SearchFoldersQuery) (model.HitList, error) {
	return s.ExpectedHitList, s.ExpectedError
}

func (s *FakeService) GetFoldersLegacy(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	s.LastQuery = q
	return s.ExpectedFolders, s.ExpectedError
}

func (s *FakeService) CountFoldersInOrg(ctx context.Context, orgID int64) (int64, error) {
	return int64(len(s.ExpectedFolders)), s.ExpectedError
}
