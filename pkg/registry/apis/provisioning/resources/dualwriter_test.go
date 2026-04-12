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
	manifest := NewFolderManifest(stableUID, "my-folder", FolderKind)
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

	fm := NewFolderManager(rw, nil, tree, FolderKind, WithFolderMetadataEnabled(true))

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
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
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
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
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
				existing := NewFolderManifest("existing-uid", "newfolder", FolderKind)
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
			name: "flag enabled: ref not found falls back to configured branch, file not found → creates on new branch",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.GitRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
						Sync:      provisioning.SyncOptions{Enabled: false},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				// First read targets the new branch → branch doesn't exist
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "new-branch").Return(nil, repository.ErrRefNotFound)
				// Fallback read targets the configured branch → file not found either
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "new-branch", mock.MatchedBy(func(b []byte) bool {
					var res folders.Folder
					if err := json.Unmarshal(b, &res); err != nil {
						return false
					}
					return res.APIVersion == "folder.grafana.app/v1beta1" &&
						res.Kind == "Folder" &&
						res.Name != "" &&
						res.Spec.Title == "newfolder"
				}), "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/", Ref: "new-branch"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "newfolder/", result.Path)
				assert.Equal(t, "new-branch", result.Ref)
			},
		},
		{
			name: "flag enabled: ref not found falls back to configured branch, file exists → reuses UID for ancestor",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.GitRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
						Sync:      provisioning.SyncOptions{Enabled: false},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)

				// Parent: branch doesn't exist → fallback to configured branch → found
				existingParent := NewFolderManifest("parent-uid-on-main", "parent", FolderKind)
				existingData, _ := json.Marshal(existingParent)
				rw.On("Read", mock.Anything, "parent/_folder.json", "new-branch").Return(nil, repository.ErrRefNotFound)
				rw.On("Read", mock.Anything, "parent/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData}, nil)

				// Child (leaf): branch doesn't exist → fallback → not found → create
				rw.On("Read", mock.Anything, "parent/child/_folder.json", "new-branch").Return(nil, repository.ErrRefNotFound)
				rw.On("Read", mock.Anything, "parent/child/_folder.json", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "parent/child/_folder.json", "new-branch", mock.MatchedBy(func(b []byte) bool {
					var f folders.Folder
					return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
				}), "").Return(nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
				return dw, DualWriteOptions{Path: "parent/child/", Ref: "new-branch"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "parent/child/", result.Path)
				assert.Equal(t, "new-branch", result.Ref)
			},
		},
		{
			name: "flag enabled: ref not found falls back to configured branch, leaf exists → AlreadyExists",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.GitRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
						Sync:      provisioning.SyncOptions{Enabled: false},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)

				// Leaf: branch doesn't exist → fallback to configured branch → found
				existingLeaf := NewFolderManifest("leaf-uid-on-main", "newfolder", FolderKind)
				existingData, _ := json.Marshal(existingLeaf)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "new-branch").Return(nil, repository.ErrRefNotFound)
				rw.On("Read", mock.Anything, "newfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData}, nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/", Ref: "new-branch"}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
			},
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

				fm := NewFolderManager(rw, mockClient, tree, FolderKind)
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

				fm := NewFolderManager(rw, mockClient, tree, FolderKind)
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

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind)
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

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
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

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
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

				fm := NewFolderManager(rw, mockClient, tree, FolderKind)
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

// mockReaderWriterWithURLs combines ReaderWriter and RepositoryWithURLs for
// testing code paths that check for URL support via type assertion.
type mockReaderWriterWithURLs struct {
	*repository.MockReaderWriter
	resourceURLsFn func(ctx context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error)
}

func (m *mockReaderWriterWithURLs) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error) {
	return m.resourceURLsFn(ctx, file)
}

func (m *mockReaderWriterWithURLs) RefURLs(_ context.Context, _ string) (*provisioning.RepositoryURLs, error) {
	return nil, nil
}

func TestMoveDirectory_FolderMetadata(t *testing.T) {
	tests := []struct {
		name        string
		setup       func(t *testing.T) (*DualReadWriter, DualWriteOptions)
		wantErr     bool
		errContains string
		check       func(t *testing.T, result *ParsedResource)
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
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: false, folders: fm}
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
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
				return dw, DualWriteOptions{
					OriginalPath: "old/",
					Path:         "new/",
					Ref:          "feature-branch",
					Message:      "move",
				}
			},
		},
		{
			name: "repo without URL support: URLs field is nil",
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
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folders: fm}
				return dw, DualWriteOptions{
					OriginalPath: "old/",
					Path:         "new/",
					Ref:          "feature-branch",
					Message:      "move",
				}
			},
			check: func(t *testing.T, result *ParsedResource) {
				assert.Nil(t, result.URLs, "URLs should be nil for repos without URL support")
			},
		},
		{
			name: "repo with URL support: URLs field is populated",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.GitRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
						Git:       &provisioning.GitRepositoryConfig{Branch: "main"},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Move", mock.Anything, "old/", "new/", "feature-branch", "move").Return(nil)

				urlRepo := &mockReaderWriterWithURLs{
					MockReaderWriter: rw,
					resourceURLsFn: func(_ context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error) {
						return &provisioning.RepositoryURLs{
							SourceURL:         "https://github.com/org/repo/tree/feature-branch/new",
							NewPullRequestURL: "https://github.com/org/repo/compare/main...feature-branch",
						}, nil
					},
				}

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(urlRepo, nil, NewEmptyFolderTree(), FolderKind)
				dw := &DualReadWriter{repo: urlRepo, authorizer: NewAuthorizer(config, urlRepo, accessMock, false), folders: fm}
				return dw, DualWriteOptions{
					OriginalPath: "old/",
					Path:         "new/",
					Ref:          "feature-branch",
					Message:      "move",
				}
			},
			check: func(t *testing.T, result *ParsedResource) {
				require.NotNil(t, result.URLs, "URLs should be populated for repos with URL support")
				assert.Equal(t, "https://github.com/org/repo/tree/feature-branch/new", result.URLs.SourceURL)
				assert.Equal(t, "https://github.com/org/repo/compare/main...feature-branch", result.URLs.NewPullRequestURL)
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
			if tt.check != nil {
				tt.check(t, result)
			}
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

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
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
		existingParent := NewFolderManifest("existing-parent-uid", "parent", FolderKind)
		existingData, _ := json.Marshal(existingParent)
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData}, nil)

		// Child: not found → create
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "parent/child/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
		}), "").Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, false), folderMetadataEnabled: true, folders: fm}
		result, err := dw.CreateFolder(context.Background(), DualWriteOptions{Path: "parent/child/"})

		require.NoError(t, err)
		require.NotNil(t, result)
		rw.AssertExpectations(t)
		rw.AssertNotCalled(t, "Create", mock.Anything, "parent/_folder.json",
			mock.Anything, mock.Anything, mock.Anything)
	})
}

func TestUpdateFolderMetadata(t *testing.T) {
	const existingUID = "existing-uid-123"

	makeExistingData := func(t *testing.T) []byte {
		t.Helper()
		manifest := NewFolderManifest(existingUID, "Original Title", FolderKind)
		data, err := json.Marshal(manifest)
		require.NoError(t, err)
		return data
	}

	makeSubmitBody := func(t *testing.T, name, title string) []byte {
		t.Helper()
		f := &folders.Folder{}
		f.Name = name
		f.Spec.Title = title
		data, err := json.Marshal(f)
		require.NoError(t, err)
		return data
	}

	tests := []struct {
		name        string
		setup       func(t *testing.T) (*DualReadWriter, DualWriteOptions)
		wantErr     bool
		errContains string
		errCheck    func(t *testing.T, err error)
		check       func(t *testing.T, result *provisioning.ResourceWrapper)
	}{
		{
			name: "successful title update",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
				rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
					var f folders.Folder
					return json.Unmarshal(b, &f) == nil && f.Name == existingUID && f.Spec.Title == "New Title"
				}), "").Return(nil)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-hash"}, nil).Once()

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, existingUID, "New Title"),
				}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "myfolder/", result.Path)
				assert.Equal(t, "new-hash", result.Hash)
				assert.Equal(t, provisioning.ResourceActionUpdate, result.Resource.Action)
				assert.Equal(t, "test-repo", result.Repository.Name)
			},
		},
		{
			name: "successful title update with ref",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.GitRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
						Git:       &provisioning.GitRepositoryConfig{Branch: "main"},
						Sync:      provisioning.SyncOptions{Enabled: false},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "feature").
					Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
				rw.On("Update", mock.Anything, "myfolder/_folder.json", "feature", mock.Anything, "update title").Return(nil)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "feature").
					Return(&repository.FileInfo{Data: []byte("{}"), Hash: "branch-hash"}, nil).Once()

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path:    "myfolder/",
					Ref:     "feature",
					Message: "update title",
					Data:    makeSubmitBody(t, existingUID, "New Title"),
				}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "feature", result.Ref)
				assert.Equal(t, "branch-hash", result.Hash)
			},
		},
		{
			name: "error: authorization fails",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.LocalRepositoryType,
						Workflows: []provisioning.Workflow{}, // no write workflow
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config).Maybe()
				accessMock := auth.NewMockAccessChecker(t)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, existingUID, "Title"),
				}
			},
			wantErr:     true,
			errContains: "authorize write",
		},
		{
			name: "error: non-directory path",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config).Maybe()
				accessMock := auth.NewMockAccessChecker(t)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder",
					Data: makeSubmitBody(t, existingUID, "Title"),
				}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got: %v", err)
				assert.Contains(t, err.Error(), "trailing slash")
			},
		},
		{
			name: "error: invalid JSON body",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config).Maybe()
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: []byte(`{not valid json`),
				}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got: %v", err)
				assert.Contains(t, err.Error(), "invalid folder resource")
			},
		},
		{
			name: "error: ID change rejected",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, "different-uid", "Title"),
				}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got: %v", err)
				assert.Contains(t, err.Error(), "folder ID change is not allowed")
			},
		},
		{
			name: "error: empty title rejected",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, existingUID, ""),
				}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got: %v", err)
				assert.Contains(t, err.Error(), "title must not be empty")
			},
		},
		{
			name: "error: folder metadata file not found",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "missing/_folder.json", "").
					Return(nil, repository.ErrFileNotFound)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "missing/",
					Data: makeSubmitBody(t, "", "Title"),
				}
			},
			wantErr:     true,
			errContains: "read existing folder metadata",
		},
		{
			name: "successful title update on new branch (ref not found fallback)",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
					Spec: provisioning.RepositorySpec{
						Type:      provisioning.GitRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
						Git:       &provisioning.GitRepositoryConfig{Branch: "main"},
						Sync:      provisioning.SyncOptions{Enabled: false},
					},
				}
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)
				// First Read with new branch ref returns ErrRefNotFound
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "folder-rename/new-title").
					Return(nil, repository.ErrRefNotFound).Once()
				// Fallback Read with empty ref (configured branch) returns existing metadata
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData, Hash: "main-hash"}, nil).Once()
				// Update writes to the new branch (repo.Update calls ensureBranchExists)
				rw.On("Update", mock.Anything, "myfolder/_folder.json", "folder-rename/new-title", mock.Anything, "rename folder").Return(nil)
				// Re-read after update returns new hash from the newly created branch
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "folder-rename/new-title").
					Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-branch-hash"}, nil).Once()

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path:    "myfolder/",
					Ref:     "folder-rename/new-title",
					Message: "rename folder",
					Data:    makeSubmitBody(t, existingUID, "New Title"),
				}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "folder-rename/new-title", result.Ref)
				assert.Equal(t, "new-branch-hash", result.Hash)
				assert.Equal(t, provisioning.ResourceActionUpdate, result.Resource.Action)
			},
		},
		{
			name: "sync enabled: updates Grafana DB and populates Upsert",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)

				updatedManifest := NewFolderManifest(existingUID, "Updated Title", FolderKind)
				updatedData, _ := json.Marshal(updatedManifest)

				// First Read: WriteFolderMetadataUpdate reads existing _folder.json
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
				rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").Return(nil)
				// Subsequent Reads: re-read for hash + EnsureFolderPathExist + ReadFolderMetadata
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: updatedData, Hash: "new-hash"}, nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				// Pre-populate tree with post-update state so EnsureFolderPathExist
				// sees a matching entry and returns early without calling EnsureFolderExists.
				tree := NewEmptyFolderTree()
				tree.Add(Folder{ID: existingUID, Title: "Updated Title", Path: "myfolder/", MetadataHash: "new-hash"}, "")

				folderObj := &unstructured.Unstructured{Object: map[string]interface{}{"kind": "Folder"}}

				mockClient := &MockDynamicResourceInterface{}
				// GetFolder call after EnsureFolderPathExist succeeds
				mockClient.On("Get", mock.Anything, existingUID, metav1.GetOptions{}, []string(nil)).
					Return(folderObj, nil)
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, tree, FolderKind, WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folders:               fm,
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, existingUID, "Updated Title"),
				}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "myfolder/", result.Path)
				assert.NotNil(t, result.Resource.Upsert.Object, "Upsert should be populated when sync is enabled")
				assert.Equal(t, provisioning.ResourceActionUpdate, result.Resource.Action)
			},
		},
		{
			name: "error: folder-level authorization denied",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).
					Return(fmt.Errorf("access denied"))
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, existingUID, "Title"),
				}
			},
			wantErr:     true,
			errContains: "authorize update folder",
		},
		{
			name: "sync disabled: no Grafana DB update, Upsert is nil",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				existingData := makeExistingData(t)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
				rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").Return(nil)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-hash"}, nil).Once()

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  rw,
					authorizer:            NewAuthorizer(config, rw, accessMock, false),
					folderMetadataEnabled: true,
				}
				return dw, DualWriteOptions{
					Path: "myfolder/",
					Data: makeSubmitBody(t, existingUID, "New Title"),
				}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Nil(t, result.Resource.Upsert.Object, "Upsert should be nil when sync is disabled")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dw, opts := tt.setup(t)
			result, err := dw.UpdateFolderMetadata(context.Background(), opts)
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
