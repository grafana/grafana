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
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

var _ folder.Service = (*FakeService)(nil)

func (s *FakeService) GetChildren(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	return s.ExpectedFoldersRef, s.ExpectedError
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
	return s.ExpectedFolders, s.ExpectedError
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
