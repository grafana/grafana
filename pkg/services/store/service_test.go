package store

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/util/testutil"
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
	globalUser          = &user.SignedInUser{OrgID: 0}
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
					"/img/icons/",
					"/img/bg/",
					"/gazetteer/",
					"/maps/",
					"/upload/",
				},
			}})
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationListFiles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	roots := []storageRuntime{publicStaticFilesStorage}

	store := newStandardStorageService(db.InitTestDB(t), roots, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, allowAllAuthService, cfg, nil)
	frame, err := store.List(context.Background(), dummyUser, "public/maps", 0)
	require.NoError(t, err)

	experimental.CheckGoldenJSONFrame(t, "testdata", "public_testdata.golden", frame.Frame, true)

	file, err := store.Read(context.Background(), dummyUser, "public/maps/countries.geojson")
	require.NoError(t, err)
	require.NotNil(t, file)

	t.Skip("Skipping golden JSON frame test as it is flaky")
	testDsFrame, err := testdatasource.LoadCsvContent(bytes.NewReader(file.Contents), file.Name)
	require.NoError(t, err)
	experimental.CheckGoldenJSONFrame(t, "testdata", "public_testdata_js_libraries.golden", testDsFrame, true)
}

func TestIntegrationListFilesWithoutPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	roots := []storageRuntime{publicStaticFilesStorage}

	store := newStandardStorageService(db.InitTestDB(t), roots, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, denyAllAuthService, cfg, nil)
	frame, err := store.List(context.Background(), dummyUser, "public/maps", 0)
	require.NoError(t, err)
	rowLen, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 0, rowLen)
}

func setupUploadStore(t *testing.T, authService storageAuthService) (StorageService, *filestorage.MockFileStorage, string) {
	t.Helper()
	storageName := "resources"
	mockStorage := &filestorage.MockFileStorage{}
	sqlStorage := newSQLStorage(RootStorageMeta{}, storageName, "Testing upload", "dummy descr", &StorageSQLConfig{}, db.InitTestDB(t), 1, false)
	sqlStorage.store = mockStorage

	if authService == nil {
		authService = allowAllAuthService
	}
	store := newStandardStorageService(db.InitTestDB(t), []storageRuntime{sqlStorage}, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, authService, cfg, nil)
	store.cfg = &GlobalStorageConfig{
		AllowUnsanitizedSvgUpload: true,
	}
	store.quotaService = quotatest.New(false, nil)

	return store, mockStorage, storageName
}

func TestIntegrationShouldUploadWhenNoFileAlreadyExists(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

func TestIntegrationShouldFailUploadWithoutAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	service, _, storageName := setupUploadStore(t, denyAllAuthService)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   jpgBytes,
		Path:       storageName + "/myFile.jpg",
	})
	require.ErrorIs(t, err, ErrAccessDenied)
}

func TestIntegrationShouldFailUploadWhenFileAlreadyExists(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	service, mockStorage, storageName := setupUploadStore(t, nil)

	mockStorage.On("Get", mock.Anything, "/myFile.jpg", &filestorage.GetFileOptions{WithContents: false}).Return(&filestorage.File{Contents: make([]byte, 0)}, true, nil)

	err := service.Upload(context.Background(), dummyUser, &UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   jpgBytes,
		Path:       storageName + "/myFile.jpg",
	})
	require.ErrorIs(t, err, ErrFileAlreadyExists)
}

func TestIntegrationShouldDelegateFileDeletion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	service, mockStorage, storageName := setupUploadStore(t, nil)

	mockStorage.On("Delete", mock.Anything, "/myFile.jpg").Return(nil)

	err := service.Delete(context.Background(), dummyUser, storageName+"/myFile.jpg")
	require.NoError(t, err)
}

func TestIntegrationShouldDelegateFolderCreation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	service, mockStorage, storageName := setupUploadStore(t, nil)

	mockStorage.On("CreateFolder", mock.Anything, "/nestedFolder/mostNestedFolder").Return(nil)

	err := service.CreateFolder(context.Background(), dummyUser, &CreateFolderCmd{Path: storageName + "/nestedFolder/mostNestedFolder"})
	require.NoError(t, err)
}

func TestIntegrationShouldDelegateFolderDeletion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

func TestIntegrationShouldUploadSvg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

func TestIntegrationShouldNotUploadHtmlDisguisedAsSvg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

func TestIntegrationShouldNotUploadJpgDisguisedAsSvg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

func TestIntegrationSetupWithNonUniqueStoragePrefixes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	prefix := "resources"
	sqlStorage := newSQLStorage(RootStorageMeta{}, prefix, "Testing upload", "dummy descr", &StorageSQLConfig{}, db.InitTestDB(t), 1, false)
	sqlStorage2 := newSQLStorage(RootStorageMeta{}, prefix, "Testing upload", "dummy descr", &StorageSQLConfig{}, db.InitTestDB(t), 1, false)

	defer func() {
		if r := recover(); r == nil {
			t.Errorf("The setup should have panicked")
		}
	}()

	newStandardStorageService(db.InitTestDB(t), []storageRuntime{sqlStorage, sqlStorage2}, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	}, allowAllAuthService, cfg, nil)
}

func TestIntegrationContentRootWithNestedStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	globalOrgID := int64(accesscontrol.GlobalOrgID)
	testDB := db.InitTestDB(t)
	orgedUser := &user.SignedInUser{OrgID: 1}

	t.Helper()
	mockContentFSApi := &filestorage.MockFileStorage{}
	contentStorage := newSQLStorage(RootStorageMeta{}, RootContent, "Content root", "dummy descr", &StorageSQLConfig{}, testDB, globalOrgID, false)
	contentStorage.store = mockContentFSApi

	nestedRoot := "nested"
	mockNestedFSApi := &filestorage.MockFileStorage{}
	nestedStorage := newSQLStorage(RootStorageMeta{}, nestedRoot, "Nested root", "dummy descr", &StorageSQLConfig{}, testDB, globalOrgID, true)
	nestedStorage.store = mockNestedFSApi

	nestedOrgedRoot := "nestedOrged"
	mockNestedOrgedFSApi := &filestorage.MockFileStorage{}
	nestedOrgedStorage := newSQLStorage(RootStorageMeta{}, nestedOrgedRoot, "Nested root", "dummy descr", &StorageSQLConfig{}, testDB, globalOrgID, true)
	nestedOrgedStorage.store = mockNestedOrgedFSApi

	store := newStandardStorageService(db.InitTestDB(t), []storageRuntime{contentStorage, nestedStorage}, func(orgId int64) []storageRuntime {
		return []storageRuntime{nestedOrgedStorage, contentStorage}
	}, allowAllAuthService, cfg, nil)
	store.cfg = &GlobalStorageConfig{
		AllowUnsanitizedSvgUpload: true,
	}
	store.quotaService = quotatest.New(false, nil)
	fileName := "file.jpg"

	tests := []struct {
		user         *user.SignedInUser
		name         string
		mockNestedFS *filestorage.MockFileStorage
		nestedRoot   string
	}{
		{
			user:         globalUser,
			name:         "global user, global nested storage",
			mockNestedFS: mockNestedFSApi,
			nestedRoot:   nestedRoot,
		},
		{
			user:         orgedUser,
			name:         "non-global user, global nested storage",
			mockNestedFS: mockNestedFSApi,
			nestedRoot:   nestedRoot,
		},
		{
			user:         orgedUser,
			name:         "non-global user, non-global nested storage",
			mockNestedFS: mockNestedOrgedFSApi,
			nestedRoot:   nestedOrgedRoot,
		},
	}

	for _, test := range tests {
		t.Run(test.name+": Uploading a file under a /content/nested/.. should delegate to the nested storage", func(t *testing.T) {
			test.mockNestedFS.On("Get", mock.Anything, filestorage.Delimiter+fileName, &filestorage.GetFileOptions{WithContents: false}).Return(nil, false, nil)
			test.mockNestedFS.On("Upsert", mock.Anything, &filestorage.UpsertFileCommand{
				Path:     filestorage.Delimiter + fileName,
				MimeType: "image/jpeg",
				Contents: jpgBytes,
			}).Return(nil)
			mockContentFSApi.AssertNotCalled(t, "Get")
			mockContentFSApi.AssertNotCalled(t, "Upsert")

			err := store.Upload(context.Background(), test.user, &UploadRequest{
				EntityType: EntityTypeImage,
				Contents:   jpgBytes,
				Path:       strings.Join([]string{RootContent, test.nestedRoot, fileName}, filestorage.Delimiter),
			})
			require.NoError(t, err)
		})

		t.Run(test.name+": Creating a /content/nested folder should fail", func(t *testing.T) {
			mockContentFSApi.AssertNotCalled(t, "CreateFolder")

			err := store.CreateFolder(context.Background(), test.user, &CreateFolderCmd{Path: RootContent + "/" + test.nestedRoot})
			require.ErrorIs(t, err, ErrValidationFailed)
		})

		t.Run(test.name+": Deleting a /content/nested folder should fail", func(t *testing.T) {
			mockContentFSApi.AssertNotCalled(t, "DeleteFolder")

			err := store.DeleteFolder(context.Background(), test.user, &DeleteFolderCmd{Path: RootContent + "/" + test.nestedRoot})
			require.ErrorIs(t, err, ErrValidationFailed)
		})

		t.Run(test.name+": Listing /content/nested should delegate to the nested root", func(t *testing.T) {
			mockContentFSApi.AssertNotCalled(t, "List")
			test.mockNestedFS.On(
				"List",
				mock.Anything,
				"/",
				mock.Anything,
				mock.Anything,
			).Return(&filestorage.ListResponse{
				Files: []*filestorage.File{},
			}, nil)

			_, err := store.List(context.Background(), test.user, RootContent+"/"+test.nestedRoot, 0)
			require.NoError(t, err)
		})

		t.Run(test.name+": Listing a folder inside /content/nested/.. should delegate to the nested root", func(t *testing.T) {
			mockContentFSApi.AssertNotCalled(t, "List")
			test.mockNestedFS.On(
				"List",
				mock.Anything,
				"/folder1/folder2",
				mock.Anything,
				mock.Anything,
			).Return(&filestorage.ListResponse{
				Files: []*filestorage.File{},
			}, nil)

			_, err := store.List(context.Background(), test.user, strings.Join([]string{RootContent, test.nestedRoot, "folder1", "folder2"}, "/"), 0)
			require.NoError(t, err)
		})

		t.Run(test.name+": Listing outside of the nested storages should delegate to the content root", func(t *testing.T) {
			test.mockNestedFS.AssertNotCalled(t, "List")

			mockContentFSApi.On(
				"List",
				mock.Anything,
				"/not-nested-content",
				mock.Anything,
				mock.Anything,
			).Return(&filestorage.ListResponse{
				Files: []*filestorage.File{},
			}, nil)

			mockContentFSApi.On(
				"List",
				mock.Anything,
				"/a/b/c",
				mock.Anything,
				mock.Anything,
			).Return(&filestorage.ListResponse{
				Files: []*filestorage.File{},
			}, nil)

			mockContentFSApi.On(
				"List",
				mock.Anything,
				fmt.Sprintf("/%sa", test.nestedRoot),
				mock.Anything,
				mock.Anything,
			).Return(&filestorage.ListResponse{
				Files: []*filestorage.File{},
			}, nil)

			mockContentFSApi.On(
				"List",
				mock.Anything,
				fmt.Sprintf("/%sa/b", test.nestedRoot),
				mock.Anything,
				mock.Anything,
			).Return(&filestorage.ListResponse{
				Files: []*filestorage.File{},
			}, nil)

			_, err := store.List(context.Background(), test.user, strings.Join([]string{RootContent, "not-nested-content"}, "/"), 0)
			require.NoError(t, err)

			_, err = store.List(context.Background(), test.user, strings.Join([]string{RootContent, "a", "b", "c"}, "/"), 0)
			require.NoError(t, err)

			_, err = store.List(context.Background(), test.user, strings.Join([]string{RootContent, test.nestedRoot + "a"}, "/"), 0)
			require.NoError(t, err)

			_, err = store.List(context.Background(), test.user, strings.Join([]string{RootContent, test.nestedRoot + "a", "b"}, "/"), 0)
			require.NoError(t, err)
		})

		t.Run(test.name+": Uploading files outside of the nested storages should delegate to the content root", func(t *testing.T) {
			test.mockNestedFS.AssertNotCalled(t, "Get")
			test.mockNestedFS.AssertNotCalled(t, "Upsert")

			// file at the root of the content root - /content/myFile.jpg
			fileName := "myFile.jpg"
			mockContentFSApi.On("Get", mock.Anything, "/"+fileName, &filestorage.GetFileOptions{WithContents: false}).Return(nil, false, nil)
			mockContentFSApi.On("Upsert", mock.Anything, &filestorage.UpsertFileCommand{
				Path:     "/" + fileName,
				MimeType: "image/jpeg",
				Contents: jpgBytes,
			}).Return(nil)

			err := store.Upload(context.Background(), dummyUser, &UploadRequest{
				EntityType: EntityTypeImage,
				Contents:   jpgBytes,
				Path:       strings.Join([]string{RootContent, fileName}, "/"),
			})
			require.NoError(t, err)

			// file in the folder belonging to the content root storage - /content/nested/a/myFile.jpg
			mockContentFSApi.On("Get", mock.Anything, "/a/"+fileName, &filestorage.GetFileOptions{WithContents: false}).Return(nil, false, nil)
			mockContentFSApi.On("Upsert", mock.Anything, &filestorage.UpsertFileCommand{
				Path:     "/a/" + fileName,
				MimeType: "image/jpeg",
				Contents: jpgBytes,
			}).Return(nil)

			err = store.Upload(context.Background(), dummyUser, &UploadRequest{
				EntityType: EntityTypeImage,
				Contents:   jpgBytes,
				Path:       strings.Join([]string{RootContent, "a", fileName}, "/"),
			})
			require.NoError(t, err)
		})

		t.Run(test.name+": Creating folders under /content/nested/.. should delegate to the nested roots", func(t *testing.T) {
			mockContentFSApi.AssertNotCalled(t, "CreateFolder")
			mockContentFSApi.AssertNotCalled(t, "DeleteFolder")

			test.mockNestedFS.On("CreateFolder", mock.Anything, "/folder").Return(nil)

			path := strings.Join([]string{RootContent, test.nestedRoot, "folder"}, "/")
			err := store.CreateFolder(context.Background(), test.user, &CreateFolderCmd{Path: path})
			require.NoError(t, err)

			test.mockNestedFS.On("DeleteFolder", mock.Anything, "/folder", mock.Anything).Return(nil)

			err = store.DeleteFolder(context.Background(), test.user, &DeleteFolderCmd{Path: path})
			require.NoError(t, err)
		})

		t.Run(test.name+": Creating folders under outside of the nested storages should delegate to the content root", func(t *testing.T) {
			test.mockNestedFS.AssertNotCalled(t, "CreateFolder")
			test.mockNestedFS.AssertNotCalled(t, "DeleteFolder")

			mockContentFSApi.On("CreateFolder", mock.Anything, "/folder").Return(nil)

			path := strings.Join([]string{RootContent, "folder"}, "/")
			err := store.CreateFolder(context.Background(), test.user, &CreateFolderCmd{Path: path})
			require.NoError(t, err)

			mockContentFSApi.On("DeleteFolder", mock.Anything, "/folder", mock.Anything).Return(nil)

			err = store.DeleteFolder(context.Background(), test.user, &DeleteFolderCmd{Path: path})
			require.NoError(t, err)
		})
	}
}

func TestIntegrationShadowingExistingFolderByNestedContentRoot(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db := db.InitTestDB(t)
	ctx := context.Background()
	nestedStorage := newSQLStorage(RootStorageMeta{}, "nested", "Testing upload", "dummy descr", &StorageSQLConfig{}, db, accesscontrol.GlobalOrgID, true)
	contentStorage := newSQLStorage(RootStorageMeta{}, RootContent, "Testing upload", "dummy descr", &StorageSQLConfig{}, db, accesscontrol.GlobalOrgID, false)

	_, err := contentStorage.Write(ctx, &WriteValueRequest{
		User:       globalUser,
		Path:       "/nested/abc.jpg",
		EntityType: EntityTypeImage,
		Body:       jpgBytes,
	})
	require.NoError(t, err)

	store := newStandardStorageService(db, []storageRuntime{nestedStorage, contentStorage}, func(orgId int64) []storageRuntime { return make([]storageRuntime, 0) }, allowAllAuthService, cfg, nil)
	store.cfg = &GlobalStorageConfig{
		AllowUnsanitizedSvgUpload: true,
	}

	resp, err := store.List(ctx, globalUser, "content/nested", 0)
	require.NoError(t, err)
	require.NotNil(t, resp)

	rowLen, err := resp.RowLen()
	require.NoError(t, err)
	require.Equal(t, 0, rowLen) // nested storage is empty

	resp, err = store.List(ctx, globalUser, "content", 0)
	require.NoError(t, err)
	require.NotNil(t, resp)

	rowLen, err = resp.RowLen()
	require.NoError(t, err)
	require.Equal(t, 1, rowLen) // just a single "nested" folder
}
