package store

import (
	"bytes"
	"context"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var (
	dummyUser = &models.SignedInUser{OrgId: 1}
)

func TestListFiles(t *testing.T) {
	publicRoot, err := filepath.Abs("../../../public")
	require.NoError(t, err)
	roots := []storageRuntime{
		newDiskStorage("public", "Public static files", &StorageLocalDiskConfig{
			Path: publicRoot,
			Roots: []string{
				"/testdata/",
				"/img/icons/",
				"/img/bg/",
				"/gazetteer/",
				"/maps/",
				"/upload/",
			},
		}).setReadOnly(true).setBuiltin(true),
	}

	store := newStandardStorageService(sqlstore.InitTestDB(t), roots, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	})
	frame, err := store.List(context.Background(), dummyUser, "public/testdata")
	require.NoError(t, err)

	experimental.CheckGoldenJSONFrame(t, "testdata", "public_testdata.golden", frame.Frame, true)

	file, err := store.Read(context.Background(), dummyUser, "public/testdata/js_libraries.csv")
	require.NoError(t, err)
	require.NotNil(t, file)

	testDsFrame, err := testdatasource.LoadCsvContent(bytes.NewReader(file.Contents), file.Name)
	require.NoError(t, err)
	experimental.CheckGoldenJSONFrame(t, "testdata", "public_testdata_js_libraries.golden", testDsFrame, true)
}

func setupUploadStore(t *testing.T) (StorageService, *filestorage.MockFileStorage, string) {
	t.Helper()
	storageName := "resources"
	mockStorage := &filestorage.MockFileStorage{}
	sqlStorage := newSQLStorage(storageName, "Testing upload", &StorageSQLConfig{orgId: 1}, sqlstore.InitTestDB(t))
	sqlStorage.store = mockStorage

	store := newStandardStorageService(sqlstore.InitTestDB(t), []storageRuntime{sqlStorage}, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	})

	return store, mockStorage, storageName
}

func TestShouldUploadWhenNoFileAlreadyExists(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t)

	mockStorage.On("Get", mock.Anything, "/myFile.jpg").Return(nil, nil)
	mockStorage.On("Upsert", mock.Anything, mock.Anything).Return(nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   make([]byte, 0),
		Path:       storageName + "/myFile.jpg",
		MimeType:   "image/jpg",
	})
	require.NoError(t, err)
}

func TestShouldFailUploadWhenFileAlreadyExists(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t)

	mockStorage.On("Get", mock.Anything, "/myFile.jpg").Return(&filestorage.File{Contents: make([]byte, 0)}, nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   make([]byte, 0),
		Path:       storageName + "/myFile.jpg",
		MimeType:   "image/jpg",
	})
	require.ErrorIs(t, err, ErrFileAlreadyExists)
}

func TestShouldDelegateFileDeletion(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t)

	mockStorage.On("Delete", mock.Anything, "/myFile.jpg").Return(nil)

	err := service.Delete(context.Background(), dummyUser, storageName+"/myFile.jpg")
	require.NoError(t, err)
}

func TestShouldDelegateFolderCreation(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t)

	mockStorage.On("CreateFolder", mock.Anything, "/nestedFolder/mostNestedFolder").Return(nil)

	err := service.CreateFolder(context.Background(), dummyUser, &CreateFolderCmd{Path: storageName + "/nestedFolder/mostNestedFolder"})
	require.NoError(t, err)
}

func TestShouldDelegateFolderDeletion(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t)

	mockStorage.On("DeleteFolder", mock.Anything, "/", &filestorage.DeleteFolderOptions{Force: true}).Return(nil)

	err := service.DeleteFolder(context.Background(), dummyUser, &DeleteFolderCmd{
		Path:  storageName,
		Force: true,
	})
	require.NoError(t, err)
}
