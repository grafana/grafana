package fakes

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

type FakeAlertingFolderService struct {
	t           *testing.T
	mtx         sync.Mutex
	Hook        func(cmd any) error // use Hook if you need to intercept some query and return an error
	RecordedOps []any
	Folders     map[int64][]*folder.Folder
}

func NewFakeAlertingFolderService(t *testing.T) *FakeAlertingFolderService {
	return &FakeAlertingFolderService{
		t: t,
		Hook: func(any) error {
			return nil
		},
		Folders: map[int64][]*folder.Folder{},
	}
}

// GetRecordedCommands filters recorded commands using predicate function. Returns the subset of the recorded commands that meet the predicate
func (f *FakeAlertingFolderService) GetRecordedCommands(predicate func(cmd any) (any, bool)) []any {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	result := make([]any, 0, len(f.RecordedOps))
	for _, op := range f.RecordedOps {
		cmd, ok := predicate(op)
		if !ok {
			continue
		}
		result = append(result, cmd)
	}
	return result
}

func (f *FakeAlertingFolderService) GetUserVisibleNamespaces(_ context.Context, orgID int64, _ identity.Requester) (map[string]*folder.Folder, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	namespacesMap := map[string]*folder.Folder{}

	for _, folder := range f.Folders[orgID] {
		namespacesMap[folder.UID] = folder
	}
	return namespacesMap, nil
}

func (f *FakeAlertingFolderService) GetNamespaceByUID(_ context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	q := GenericRecordedQuery{
		Name:   "GetNamespaceByUID",
		Params: []any{orgID, uid, user},
	}
	defer func() {
		f.RecordedOps = append(f.RecordedOps, q)
	}()
	err := f.Hook(q)
	if err != nil {
		return nil, err
	}
	folders := f.Folders[orgID]
	for _, folder := range folders {
		if folder.UID == uid {
			return folder, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (f *FakeAlertingFolderService) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.Folder, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	for _, folder := range f.Folders[orgID] {
		if folder.Title == title && folder.ParentUID == parentUID {
			return folder, nil
		}
	}

	newFolder := &folder.Folder{
		ID:        rand.Int63(), // nolint:staticcheck
		UID:       util.GenerateShortUID(),
		Title:     title,
		ParentUID: parentUID,
		Fullpath:  "fullpath_" + title,
	}

	f.Folders[orgID] = append(f.Folders[orgID], newFolder)
	return newFolder, nil
}

func (f *FakeAlertingFolderService) GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.Folder, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	for _, folder := range f.Folders[orgID] {
		if folder.Title == title && folder.ParentUID == parentUID {
			return folder, nil
		}
	}

	return nil, dashboards.ErrFolderNotFound
}

func (f *FakeAlertingFolderService) GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.Folder, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	result := []*folder.Folder{}

	for _, folder := range f.Folders[orgID] {
		if folder.ParentUID == uid {
			result = append(result, folder)
		}
	}

	if len(result) == 0 {
		return nil, dashboards.ErrFolderNotFound
	}

	return result, nil
}
