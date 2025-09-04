package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestFolderSyncHooks_Create(t *testing.T) {
	tests := []struct {
		name                   string
		expectedCallsToZanzana int
		folder                 runtime.Object
		updateSuccessful       bool
	}{
		{
			name:                   "folder at root does nothing",
			expectedCallsToZanzana: 0,
			folder:                 getFolderObj("foo", ""),
			updateSuccessful:       true,
		},
		{
			name:                   "unsuccessful create does nothing",
			expectedCallsToZanzana: 0,
			folder:                 getFolderObj("foo", "bar"),
			updateSuccessful:       false,
		},
		{
			name:                   "successful create writes to zanzana",
			expectedCallsToZanzana: 1,
			folder:                 getFolderObj("foo", "bar"),
			updateSuccessful:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			storeMock := newMockStore()
			b := &FolderAPIBuilder{
				permissionStore: storeMock,
			}

			f, err := b.beginCreate(nil, tt.folder, nil)
			if err != nil {
				require.NoError(t, err)
			}

			f(nil, tt.updateSuccessful)

			storeMock.AssertNumberOfCalls(t, "SetFolderParent", tt.expectedCallsToZanzana)
		})
	}
}

func TestFolderSyncHooks_Update(t *testing.T) {
	tests := []struct {
		name                   string
		expectedCallsToZanzana int
		newFolder              runtime.Object
		oldFolder              runtime.Object
		updateSuccessful       bool
	}{
		{
			name:                   "no folder change does nothing",
			expectedCallsToZanzana: 0,
			oldFolder:              getFolderObj("foo", "bar"),
			newFolder:              getFolderObj("foo", "bar"),
			updateSuccessful:       true,
		},
		{
			name:                   "unsuccessful update does nothing",
			expectedCallsToZanzana: 0,
			oldFolder:              getFolderObj("foo", "bar"),
			newFolder:              getFolderObj("foo", "hop"),
			updateSuccessful:       false,
		},
		{
			name:                   "successful update writes to zanzana",
			expectedCallsToZanzana: 1,
			oldFolder:              getFolderObj("foo", "bar"),
			newFolder:              getFolderObj("foo", "hop"),
			updateSuccessful:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			storeMock := newMockStore()
			b := &FolderAPIBuilder{
				permissionStore: storeMock,
			}

			f, err := b.beginUpdate(nil, tt.newFolder, tt.oldFolder, nil)
			if err != nil {
				require.NoError(t, err)
			}

			f(nil, tt.updateSuccessful)

			storeMock.AssertNumberOfCalls(t, "SetFolderParent", tt.expectedCallsToZanzana)
		})
	}
}

func getFolderObj(uid, parentUid string) runtime.Object {
	f, _ := LegacyCreateCommandToUnstructured(&folder.CreateFolderCommand{
		UID:       uid,
		ParentUID: parentUid,
	})
	return f
}

func newMockStore() *mockZanzanaPermissionStore {
	store := mockZanzanaPermissionStore{}
	store.On("SetFolderParent", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	return &store
}

type mockZanzanaPermissionStore struct {
	mock.Mock
	reconcilers.PermissionStore
}

func (m *mockZanzanaPermissionStore) SetFolderParent(_ context.Context, _, _, _ string) error {
	m.Called()
	return nil
}
