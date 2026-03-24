package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

func TestGetPathType(t *testing.T) {
	tests := []struct {
		name     string
		isDir    bool
		expected string
	}{
		{
			name:     "directory path",
			isDir:    true,
			expected: "directory (ends with '/')",
		},
		{
			name:     "file path",
			isDir:    false,
			expected: "file (no trailing '/')",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getPathType(tt.isDir)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMovePathValidation(t *testing.T) {
	tests := []struct {
		name         string
		originalPath string
		newPath      string
		expectError  bool
		errorMessage string
	}{
		{
			name:         "file to file move (valid)",
			originalPath: "old/file.json",
			newPath:      "new/file.json",
			expectError:  false,
		},
		{
			name:         "directory to directory move (valid)",
			originalPath: "old/folder/",
			newPath:      "new/folder/",
			expectError:  false,
		},
		{
			name:         "file to directory move (invalid)",
			originalPath: "old/file.json",
			newPath:      "new/folder/",
			expectError:  true,
			errorMessage: "cannot move between file and directory types",
		},
		{
			name:         "directory to file move (invalid)",
			originalPath: "old/folder/",
			newPath:      "new/file.json",
			expectError:  true,
			errorMessage: "cannot move between file and directory types",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the path validation logic that would be used in MoveResource
			sourceIsDir := safepath.IsDir(tt.originalPath)
			targetIsDir := safepath.IsDir(tt.newPath)

			if tt.expectError {
				assert.NotEqual(t, sourceIsDir, targetIsDir, "Path types should be different for invalid moves")
			} else {
				assert.Equal(t, sourceIsDir, targetIsDir, "Path types should be the same for valid moves")
			}
		})
	}
}

func TestMoveOptionsContentHandling(t *testing.T) {
	tests := []struct {
		name                 string
		opts                 DualWriteOptions
		originalData         []byte
		expectedContentToUse []byte
		expectedUseOriginal  bool
	}{
		{
			name: "move with new content provided",
			opts: DualWriteOptions{
				Path:         "new/file.json",
				OriginalPath: "old/file.json",
				Data:         []byte(`{"updated": "content"}`),
			},
			originalData:         []byte(`{"original": "content"}`),
			expectedContentToUse: []byte(`{"updated": "content"}`),
			expectedUseOriginal:  false,
		},
		{
			name: "move without new content (nil)",
			opts: DualWriteOptions{
				Path:         "new/file.json",
				OriginalPath: "old/file.json",
				Data:         nil,
			},
			originalData:         []byte(`{"original": "content"}`),
			expectedContentToUse: []byte(`{"original": "content"}`),
			expectedUseOriginal:  true,
		},
		{
			name: "move without new content (empty slice)",
			opts: DualWriteOptions{
				Path:         "new/file.json",
				OriginalPath: "old/file.json",
				Data:         []byte{},
			},
			originalData:         []byte(`{"original": "content"}`),
			expectedContentToUse: []byte(`{"original": "content"}`),
			expectedUseOriginal:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the content selection logic from moveFile method
			var destinationData []byte
			useOriginal := len(tt.opts.Data) == 0

			if useOriginal {
				destinationData = tt.originalData
			} else {
				destinationData = tt.opts.Data
			}

			assert.Equal(t, tt.expectedUseOriginal, useOriginal, "Should correctly determine whether to use original content")
			assert.Equal(t, tt.expectedContentToUse, destinationData, "Should select correct content for destination")
		})
	}
}

func TestShouldUpdateGrafanaDB(t *testing.T) {
	tests := []struct {
		name   string
		repo   provisioning.RepositorySpec
		opts   DualWriteOptions
		parsed *ParsedResource
		expect bool
	}{
		{
			name: "update when parsed and sync enabled",
			opts: DualWriteOptions{
				Ref: "something",
			},
			repo: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					Branch: "something",
				},
				Sync: provisioning.SyncOptions{
					Enabled: true,
				},
			},
			parsed: &ParsedResource{
				Client: &MockDynamicResourceInterface{},
			},
			expect: true,
		}, {
			name: "do not write when its a different branch",
			opts: DualWriteOptions{
				Ref: "something",
			},
			repo: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					Branch: "something-else",
				},
				Sync: provisioning.SyncOptions{
					Enabled: true,
				},
			},
			parsed: &ParsedResource{
				Client: &MockDynamicResourceInterface{},
			},
			expect: false,
		}, {
			name: "do not write when sync is disabled",
			opts: DualWriteOptions{
				Ref: "something",
			},
			repo: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					Branch: "something",
				},
				Sync: provisioning.SyncOptions{
					Enabled: false, // <<<<<<
				},
			},
			parsed: &ParsedResource{
				Client: &MockDynamicResourceInterface{},
			},
			expect: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rw := repository.NewMockReaderWriter(t)
			rw.On("Config").Return(&provisioning.Repository{Spec: tt.repo})
			dw := &DualReadWriter{repo: rw}

			update := dw.shouldUpdateGrafanaDB(tt.opts, tt.parsed)

			assert.Equal(t, tt.expect, update, "Should correctly determine if we should update")
		})
	}
}

func newTestRepoConfig(name string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
		},
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.LocalRepositoryType,
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			Sync:      provisioning.SyncOptions{Enabled: false},
		},
	}
}

func newSyncEnabledConfig(name string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.LocalRepositoryType,
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			Sync:      provisioning.SyncOptions{Enabled: true},
		},
	}
}

// TestEnsureFolderPathExist_UsesStableUID verifies that EnsureFolderPathExist uses
// the stable UID from _folder.json instead of the hash-derived UID when the file exists.
func TestEnsureFolderPathExist_UsesStableUID(t *testing.T) {
	ctx := context.Background()
	stableUID := "my-stable-uid"

	// Prepare _folder.json content with the stable UID
	manifest := NewFolderManifest(stableUID, "my-folder")
	data, err := json.Marshal(manifest)
	require.NoError(t, err)

	config := newTestRepoConfig("test-repo")
	rw := repository.NewMockReaderWriter(t)
	rw.On("Config").Return(config)
	rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").Return(&repository.FileInfo{Data: data}, nil)

	// Pre-populate the tree with the stable UID only — if effectiveFolderID is not
	// called the hash-based UID won't match and EnsureFolderExists would be invoked
	// (which would panic since the dynamic client is nil).
	tree := NewEmptyFolderTree()
	tree.Add(Folder{ID: stableUID, Title: "my-folder", Path: "my-folder/"}, "")

	fm := NewFolderManager(rw, nil, tree, WithFolderMetadataEnabled(true))

	parentID, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
	require.NoError(t, err)
	require.Equal(t, stableUID, parentID)
}

func TestCreateFolder(t *testing.T) {
	tests := []struct {
		name        string
		setup       func(t *testing.T) (*DualReadWriter, DualWriteOptions)
		wantErr     bool
		errContains string
		errCheck    func(t *testing.T, err error)
		check       func(t *testing.T, result *provisioning.ResourceWrapper)
	}{
		{
			name: "flag disabled: creates .keep file",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false)}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "newfolder/", result.Path)
			},
		},
		{
			name: "flag enabled: writes _folder.json",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(nil, repository.ErrFileNotFound)
				var capturedUID string
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
					var res folders.Folder
					if err := json.Unmarshal(b, &res); err != nil {
						return false
					}
					capturedUID = res.Name
					return res.APIVersion == "folder.grafana.app/v1beta1" &&
						res.Kind == "Folder" &&
						res.Name != "" &&
						res.Spec.Title == "newfolder"
				}), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
				t.Cleanup(func() { assert.NotEmpty(t, capturedUID, "_folder.json should have a non-empty metadata.name") })
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "newfolder/", result.Path)
			},
		},
		{
			name: "error: non-directory path",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config).Maybe() // AuthorizeWrite will call Config() before the IsDir check
				accessMock := auth.NewMockAccessChecker(t)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false)}
				return dw, DualWriteOptions{Path: "not-a-folder"}
			},
			wantErr:     true,
			errContains: "not a folder path",
		},
		{
			name: "error: write not allowed",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.LocalRepositoryType,
						Workflows: []provisioning.Workflow{}, // no WriteWorkflow
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config).Maybe() // AuthorizeWrite will call Config()
				accessMock := auth.NewMockAccessChecker(t)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false)}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
		{
			name: "error: auth failed",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config).Maybe() // AuthorizeWrite calls Config()
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(fmt.Errorf("unauthorized")).Maybe()
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false)}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
		{
			name: "error: flag disabled, repo.Create fails",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(fmt.Errorf("git error"))
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false)}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr:     true,
			errContains: "failed to create folder",
		},
		{
			name: "error: flag enabled, WriteFolderMetadata fails",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.Anything, "").Return(fmt.Errorf("repo error"))
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
		{
			name: "error: flag enabled, leaf already has _folder.json returns AlreadyExists",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				existing := NewFolderManifest("existing-uid", "newfolder")
				existingData, _ := json.Marshal(existing)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(&repository.FileInfo{Data: existingData}, nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
			},
		},
		{
			name: "error: flag enabled, read error other than not-found is propagated",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(nil, fmt.Errorf("network error"))
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr:     true,
			errContains: "failed to read folder metadata",
		},
		{
			name: "sync enabled, flag disabled: GetFolder not found → no Upsert",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				tree := NewEmptyFolderTree()
				folder := ParseFolder("newfolder/", "test-repo")
				tree.Add(folder, "")

				notFound := apierrors.NewNotFound(schema.GroupResource{}, folder.ID)
				mockClient := &MockDynamicResourceInterface{}
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(nil, notFound)
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, tree)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Nil(t, result.Resource.Upsert.Object)
			},
		},
		{
			name: "sync enabled, flag disabled: GetFolder returns folder → Upsert populated",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				tree := NewEmptyFolderTree()
				folder := ParseFolder("newfolder/", "test-repo")
				tree.Add(folder, "")

				folderObj := &unstructured.Unstructured{Object: map[string]interface{}{"k": "v"}}
				mockClient := &MockDynamicResourceInterface{}
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(folderObj, nil)
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, tree)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.NotNil(t, result.Resource.Upsert.Object)
			},
		},
		{
			name: "sync enabled, flag disabled: EnsureFolderPathExist error",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				// Empty tree so EnsureFolderPathExist has to walk and call EnsureFolderExists
				mockClient := &MockDynamicResourceInterface{}
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(nil, fmt.Errorf("server error"))
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree())
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
		{
			name: "sync enabled, flag enabled: full happy path → Upsert populated",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.Anything, "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				notFound := apierrors.NewNotFound(schema.GroupResource{}, "uid")
				folderObj := &unstructured.Unstructured{Object: map[string]interface{}{"foo": "bar"}}
				mockClient := &MockDynamicResourceInterface{}
				// EnsureFolderExists (CreateFolderWithUID): Get → NotFound, Create succeeds
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(nil, notFound).Once()
				mockClient.On("Create", mock.Anything, mock.Anything, metav1.CreateOptions{}, []string(nil)).
					Return(&unstructured.Unstructured{Object: map[string]interface{}{}}, nil).Once()
				// GetFolder: Get → folderObj
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(folderObj, nil).Once()
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm, folderMetadataEnabled: true}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.NotNil(t, result.Resource.Upsert.Object)
			},
		},
		{
			name: "sync enabled, flag enabled: CreateFolderWithUID error",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.Anything, "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				mockClient := &MockDynamicResourceInterface{}
				// EnsureFolderExists (CreateFolderWithUID): Get → non-NotFound error
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(nil, fmt.Errorf("server error")).Once()
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm, folderMetadataEnabled: true}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
		{
			name: "sync enabled, flag disabled: GetFolder non-NotFound error",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				tree := NewEmptyFolderTree()
				folder := ParseFolder("newfolder/", "test-repo")
				tree.Add(folder, "")

				mockClient := &MockDynamicResourceInterface{}
				// GetFolder: non-NotFound error
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(nil, fmt.Errorf("server error"))
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, tree)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dw, opts := tt.setup(t)
			result, err := dw.CreateFolder(context.Background(), opts)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				if tt.errCheck != nil {
					tt.errCheck(t, err)
				}
				return
			}
			require.NoError(t, err)
			require.NotNil(t, result)
			if tt.check != nil {
				tt.check(t, result)
			}
		})
	}
}

func TestMoveDirectory_FolderMetadata(t *testing.T) {
	tests := []struct {
		name        string
		setup       func(t *testing.T) (*DualReadWriter, DualWriteOptions)
		wantErr     bool
		errContains string
	}{
		{
			name: "flag disabled: moves directory, no _folder.json written",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.LocalRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
						Git:       &provisioning.GitRepositoryConfig{Branch: "main"},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Move", mock.Anything, "old/", "new/", "feature-branch", "move").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: false}
				return dw, DualWriteOptions{
					OriginalPath: "old/",
					Path:         "new/",
					Ref:          "feature-branch",
					Message:      "move",
				}
			},
		},
		{
			name: "flag enabled: moves directory, no _folder.json written",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.LocalRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
						Git:       &provisioning.GitRepositoryConfig{Branch: "main"},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Move", mock.Anything, "old/", "new/", "feature-branch", "move").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
				return dw, DualWriteOptions{
					OriginalPath: "old/",
					Path:         "new/",
					Ref:          "feature-branch",
					Message:      "move",
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dw, opts := tt.setup(t)
			result, err := dw.moveDirectory(context.Background(), opts)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				return
			}
			require.NoError(t, err)
			require.NotNil(t, result)
		})
	}
}

func TestCreateFolder_Nested_FolderMetadata(t *testing.T) {
	t.Run("flag enabled: nested folder creates _folder.json for every segment", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

		// Parent: not found → create
		rw.On("Read", mock.Anything, "parent/_folder.json", "").Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "parent/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "parent"
		}), "").Return(nil)

		// Child (leaf): not found → create
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "parent/child/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
		}), "").Return(nil)

		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
		result, err := dw.CreateFolder(context.Background(), DualWriteOptions{Path: "parent/child/"})

		require.NoError(t, err)
		require.NotNil(t, result)
		rw.AssertExpectations(t)
	})

	t.Run("flag enabled: skips existing parent _folder.json, creates child", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

		// Parent: already exists → skip (no Create call)
		existingParent := NewFolderManifest("existing-parent-uid", "parent")
		existingData, _ := json.Marshal(existingParent)
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData}, nil)

		// Child: not found → create
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "parent/child/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
		}), "").Return(nil)

		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true}
		result, err := dw.CreateFolder(context.Background(), DualWriteOptions{Path: "parent/child/"})

		require.NoError(t, err)
		require.NotNil(t, result)
		rw.AssertExpectations(t)
		rw.AssertNotCalled(t, "Create", mock.Anything, "parent/_folder.json",
			mock.Anything, mock.Anything, mock.Anything)
	})
}
