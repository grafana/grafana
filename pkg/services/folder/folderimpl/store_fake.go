package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/folder"
)

type FakeStore struct {
	ExpectedChildFolders  []*folder.Folder
	ExpectedParentFolders []*folder.Folder
	ExpectedFolder        *folder.Folder
	ExpectedError         error
	ExpectedFolderHeight  int
	CreateCalled          bool
	DeleteCalled          bool
}

func NewFakeStore() *FakeStore {
	return &FakeStore{}
}

var _ store = (*FakeStore)(nil)

func (f *FakeStore) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	f.CreateCalled = true
	return f.ExpectedFolder, f.ExpectedError
}

func (f *FakeStore) Delete(ctx context.Context, uid string, orgID int64) error {
	f.DeleteCalled = true
	return f.ExpectedError
}

func (f *FakeStore) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	return f.ExpectedFolder, f.ExpectedError
}

func (f *FakeStore) Move(ctx context.Context, cmd folder.MoveFolderCommand) error {
	return f.ExpectedError
}

func (f *FakeStore) Get(ctx context.Context, cmd folder.GetFolderQuery) (*folder.Folder, error) {
	return f.ExpectedFolder, f.ExpectedError
}

func (f *FakeStore) GetParents(ctx context.Context, cmd folder.GetParentsQuery) ([]*folder.Folder, error) {
	return f.ExpectedParentFolders, f.ExpectedError
}

func (f *FakeStore) GetChildren(ctx context.Context, cmd folder.GetChildrenQuery) ([]*folder.Folder, error) {
	return f.ExpectedChildFolders, f.ExpectedError
}

func (f *FakeStore) GetHeight(ctx context.Context, folderUID string, orgID int64, parentUID *string) (int, error) {
	return f.ExpectedFolderHeight, f.ExpectedError
}
