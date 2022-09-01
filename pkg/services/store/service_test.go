package store

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var (
	cfg = &setting.Cfg{
		Storage: setting.StorageSettings{
			AllowUnsanitizedSvgUpload: true,
		},
	}

	htmlBytes, _        = os.ReadFile("testdata/page.html")
	jpgBytes, _         = os.ReadFile("testdata/image.jpg")
	svgBytes, _         = os.ReadFile("testdata/image.svg")
	dummyUser           = &user.SignedInUser{OrgID: 1}
	allowAllAuthService = newStaticStorageAuthService(func(ctx context.Context, user *user.SignedInUser, storageName string) map[string]filestorage.PathFilter {
		return map[string]filestorage.PathFilter{
			ActionFilesDelete: allowAllPathFilter,
			ActionFilesWrite:  allowAllPathFilter,
			ActionFilesRead:   allowAllPathFilter,
		}
	})
	denyAllAuthService = newStaticStorageAuthService(func(ctx context.Context, user *user.SignedInUser, storageName string) map[string]filestorage.PathFilter {
		return map[string]filestorage.PathFilter{
			ActionFilesDelete: denyAllPathFilter,
			ActionFilesWrite:  denyAllPathFilter,
			ActionFilesRead:   denyAllPathFilter,
		}
	})
	publicRoot, _            = filepath.Abs("../../../public")
	publicStaticFilesStorage = newDiskStorage(
		RootStorageMeta{
			Builtin:  true,
			ReadOnly: true,
		}, RootStorageConfig{
			Prefix: "public",
			Name:   "Public static files",
			Disk: &StorageLocalDiskConfig{
				Path: publicRoot,
				Roots: []string{
					"/testdata/",
					"/img/icons/",
					"/img/bg/",
					"/gazetteer/",
					"/maps/",
					"/upload/",
				},
			}})
)

func TestListFiles(t *testing.T) {
	roots := []storageRuntime{publicStaticFilesStorage}

	store := newStandardStorageService(sqlstore.InitTestDB(t), roots, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, allowAllAuthService, cfg)
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

func TestListFilesWithoutPermissions(t *testing.T) {
	roots := []storageRuntime{publicStaticFilesStorage}

	store := newStandardStorageService(sqlstore.InitTestDB(t), roots, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, denyAllAuthService, cfg)
	frame, err := store.List(context.Background(), dummyUser, "public/testdata")
	require.NoError(t, err)
	rowLen, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 0, rowLen)
}

func setupUploadStore(t *testing.T, authService storageAuthService) (StorageService, *filestorage.MockFileStorage, string) {
	t.Helper()
	storageName := "resources"
	mockStorage := &filestorage.MockFileStorage{}
	sqlStorage := newSQLStorage(
		RootStorageMeta{},
		storageName, "Testing upload", "dummy descr",
		&StorageSQLConfig{},
		sqlstore.InitTestDB(t),
		1, // orgID (prefix init)
	)
	sqlStorage.store = mockStorage

	if authService == nil {
		authService = allowAllAuthService
	}
	store := newStandardStorageService(sqlstore.InitTestDB(t), []storageRuntime{sqlStorage}, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, authService, cfg)
	store.cfg = &GlobalStorageConfig{
		AllowUnsanitizedSvgUpload: true,
	}
	store.quotaService = quotatest.NewQuotaServiceFake()

	return store, mockStorage, storageName
}

func TestShouldUploadWhenNoFileAlreadyExists(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	fileName := "/myFile.jpg"
	mockStorage.On("Get", mock.Anything, fileName, &filestorage.GetFileOptions{WithContents: false}).Return(nil, false, nil)
	mockStorage.On("Upsert", mock.Anything, &filestorage.UpsertFileCommand{
		Path:     fileName,
		MimeType: "image/jpeg",
		Contents: jpgBytes,
	}).Return(nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   jpgBytes,
		Path:       storageName + fileName,
	})
	require.NoError(t, err)
}

func TestShouldFailUploadWithoutAccess(t *testing.T) {
	service, _, storageName := setupUploadStore(t, denyAllAuthService)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   jpgBytes,
		Path:       storageName + "/myFile.jpg",
	})
	require.ErrorIs(t, err, ErrAccessDenied)
}

func TestShouldFailUploadWhenFileAlreadyExists(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	mockStorage.On("Get", mock.Anything, "/myFile.jpg", &filestorage.GetFileOptions{WithContents: false}).Return(&filestorage.File{Contents: make([]byte, 0)}, true, nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   jpgBytes,
		Path:       storageName + "/myFile.jpg",
	})
	require.ErrorIs(t, err, ErrFileAlreadyExists)
}

func TestShouldDelegateFileDeletion(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	mockStorage.On("Delete", mock.Anything, "/myFile.jpg").Return(nil)

	err := service.Delete(context.Background(), dummyUser, storageName+"/myFile.jpg")
	require.NoError(t, err)
}

func TestShouldDelegateFolderCreation(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	mockStorage.On("CreateFolder", mock.Anything, "/nestedFolder/mostNestedFolder").Return(nil)

	err := service.CreateFolder(context.Background(), dummyUser, &CreateFolderCmd{Path: storageName + "/nestedFolder/mostNestedFolder"})
	require.NoError(t, err)
}

func TestShouldDelegateFolderDeletion(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)
	cmds := []*DeleteFolderCmd{
		{
			Path:  storageName,
			Force: false,
		},
		{
			Path:  storageName,
			Force: true,
		}}

	ctx := context.Background()

	for _, cmd := range cmds {
		mockStorage.On("DeleteFolder", ctx, "/", &filestorage.DeleteFolderOptions{
			Force:        cmd.Force,
			AccessFilter: allowAllPathFilter,
		}).Once().Return(nil)
		err := service.DeleteFolder(ctx, dummyUser, cmd)
		require.NoError(t, err)
	}
}

func TestShouldUploadSvg(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	fileName := "/myFile.svg"
	mockStorage.On("Get", mock.Anything, fileName, &filestorage.GetFileOptions{WithContents: false}).Return(nil, false, nil)
	mockStorage.On("Upsert", mock.Anything, &filestorage.UpsertFileCommand{
		Path:     fileName,
		MimeType: "image/svg+xml",
		Contents: svgBytes,
	}).Return(nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   svgBytes,
		Path:       storageName + fileName,
	})
	require.NoError(t, err)
}

func TestShouldNotUploadHtmlDisguisedAsSvg(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	fileName := "/myFile.svg"
	mockStorage.On("Get", mock.Anything, fileName).Return(nil, nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   htmlBytes,
		Path:       storageName + fileName,
	})
	require.ErrorIs(t, err, ErrValidationFailed)
}

func TestShouldNotUploadJpgDisguisedAsSvg(t *testing.T) {
	service, mockStorage, storageName := setupUploadStore(t, nil)

	fileName := "/myFile.svg"
	mockStorage.On("Get", mock.Anything, fileName).Return(nil, nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   jpgBytes,
		Path:       storageName + fileName,
	})
	require.ErrorIs(t, err, ErrValidationFailed)
}
