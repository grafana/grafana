package folder

import (
	"context"
)

type fakeStore struct {
	ExpectedChildFolders  []*FolderReference
	ExpectedParentFolders []*Folder
	ExpectedFolders       []*Folder
	ExpectedFolder        *Folder
	ExpectedError         error
	ExpectedFolderHeight  int
	CreateCalled          bool
	DeleteCalled          bool
}

func NewFakeStore() *fakeStore {
	return &fakeStore{}
}

var _ Store = (*fakeStore)(nil)

func (f *fakeStore) Create(ctx context.Context, cmd CreateFolderCommand) (*Folder, error) {
	f.CreateCalled = true
	return f.ExpectedFolder, f.ExpectedError
}

func (f *fakeStore) Delete(ctx context.Context, UIDs []string, orgID int64) error {
	f.DeleteCalled = true
	return f.ExpectedError
}

func (f *fakeStore) Update(ctx context.Context, cmd UpdateFolderCommand) (*Folder, error) {
	return f.ExpectedFolder, f.ExpectedError
}

func (f *fakeStore) Move(ctx context.Context, cmd MoveFolderCommand) error {
	return f.ExpectedError
}

func (f *fakeStore) Get(ctx context.Context, cmd GetFolderQuery) (*Folder, error) {
	return f.ExpectedFolder, f.ExpectedError
}

func (f *fakeStore) GetParents(ctx context.Context, q GetParentsQuery) ([]*Folder, error) {
	return f.ExpectedParentFolders, f.ExpectedError
}

func (f *fakeStore) GetChildren(ctx context.Context, cmd GetChildrenQuery) ([]*FolderReference, error) {
	return f.ExpectedChildFolders, f.ExpectedError
}

func (f *fakeStore) GetHeight(ctx context.Context, folderUID string, orgID int64, parentUID *string) (int, error) {
	return f.ExpectedFolderHeight, f.ExpectedError
}

func (f *fakeStore) GetFolders(ctx context.Context, q GetFoldersFromStoreQuery) ([]*Folder, error) {
	return f.ExpectedFolders, f.ExpectedError
}

func (f *fakeStore) GetDescendants(ctx context.Context, orgID int64, ancestor_uid string) ([]*Folder, error) {
	return f.ExpectedFolders, f.ExpectedError
}

func (f *fakeStore) CountInOrg(ctx context.Context, orgID int64) (int64, error) {
	return int64(len(f.ExpectedFolders)), f.ExpectedError
}
