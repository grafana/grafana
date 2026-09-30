package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/nanogit/storage"
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false), folderMetadataEnabled: true}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false), folderMetadataEnabled: true}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm, folderMetadataEnabled: true}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm, folderMetadataEnabled: true}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: false, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
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
				dw := &DualReadWriter{repo: urlRepo, authorizer: NewAuthorizer(config, urlRepo, accessMock, authTestClients(t), fm, false), folders: fm}
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
		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folderMetadataEnabled: true, folders: fm}
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
		{
			name: "repo with URL support: URLs field is populated",
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

				urlRepo := &mockReaderWriterWithURLs{
					MockReaderWriter: rw,
					resourceURLsFn: func(_ context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error) {
						// URLs must resolve to the updated _folder.json file, not the directory.
						assert.Equal(t, "myfolder/_folder.json", file.Path)
						return &provisioning.RepositoryURLs{
							SourceURL:         "https://github.com/org/repo/blob/feature/myfolder/_folder.json",
							NewPullRequestURL: "https://github.com/org/repo/compare/main...feature",
						}, nil
					},
				}

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{
					repo:                  urlRepo,
					authorizer:            NewAuthorizer(config, urlRepo, accessMock, authTestClients(t), nil, false),
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
				require.NotNil(t, result.URLs, "URLs should be populated for repos with URL support")
				assert.Equal(t, "https://github.com/org/repo/blob/feature/myfolder/_folder.json", result.URLs.SourceURL)
				assert.Equal(t, "https://github.com/org/repo/compare/main...feature", result.URLs.NewPullRequestURL)
			},
		},
		{
			name: "repo without URL support: URLs field is nil",
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
					authorizer:            NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false),
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
				assert.Nil(t, result.URLs, "URLs should be nil for repos without URL support")
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

func TestWriteNewFoldersMetadata(t *testing.T) {
	t.Run("writes _folder.json with stable UID for new folder", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "new-folder/", "test-ref").
			Return(nil, repository.ErrFileNotFound)

		var writtenData []byte
		rw.On("Create", mock.Anything, "new-folder/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg").
			Run(func(args mock.Arguments) { writtenData = args.Get(3).([]byte) }).
			Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		err := dw.writeNewFoldersMetadata(context.Background(), rw, "new-folder/dashboard.json", "test-ref", "msg")

		require.NoError(t, err)
		rw.AssertCalled(t, "Create", mock.Anything, "new-folder/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")

		// UID must be a stable short UID, not the hash-derived folder ID.
		var manifest folders.Folder
		require.NoError(t, json.Unmarshal(writtenData, &manifest))
		hashID := ParseFolder("new-folder/", "test-repo").ID
		require.NotEmpty(t, manifest.Name)
		require.NotEqual(t, hashID, manifest.Name)
	})

	t.Run("does not write when folder already exists", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		// Folder directory already exists in the repo (with or without metadata).
		rw.On("Read", mock.Anything, "existing-folder/", "test-ref").
			Return(&repository.FileInfo{Path: "existing-folder/"}, nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		err := dw.writeNewFoldersMetadata(context.Background(), rw, "existing-folder/dashboard.json", "test-ref", "msg")

		require.NoError(t, err)
		rw.AssertNotCalled(t, "Create", mock.Anything, "existing-folder/_folder.json", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("writes _folder.json for each missing ancestor in nested path", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "a/", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		rw.On("Read", mock.Anything, "a/b/", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "a/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg").
			Return(nil)
		rw.On("Create", mock.Anything, "a/b/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg").
			Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		err := dw.writeNewFoldersMetadata(context.Background(), rw, "a/b/dashboard.json", "test-ref", "msg")

		require.NoError(t, err)
		rw.AssertCalled(t, "Create", mock.Anything, "a/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")
		rw.AssertCalled(t, "Create", mock.Anything, "a/b/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")
	})

	t.Run("no-op for root-level file", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		err := dw.writeNewFoldersMetadata(context.Background(), rw, "dashboard.json", "test-ref", "msg")

		require.NoError(t, err)
		rw.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})
}

func TestMoveResourceAndCreateNewFolderMetadata(t *testing.T) {
	data := []byte("saved-resource")

	t.Run("content move into new folder writes _folder.json then deletes and recreates", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "new-folder/", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "new-folder/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg").
			Return(nil)
		rw.On("Delete", mock.Anything, "old-folder/dashboard.json", "test-ref", "msg").Return(nil)
		rw.On("Create", mock.Anything, "new-folder/dashboard.json", "test-ref", data, "msg").Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		opts := DualWriteOptions{
			OriginalPath: "old-folder/dashboard.json",
			Path:         "new-folder/dashboard.json",
			Ref:          "test-ref",
			Message:      "msg",
			Data:         []byte("new content"),
		}
		err := dw.moveResourceAndCreateNewFolderMetadata(context.Background(), opts, data)(rw, false)

		require.NoError(t, err)
		rw.AssertCalled(t, "Create", mock.Anything, "new-folder/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")
		rw.AssertCalled(t, "Delete", mock.Anything, "old-folder/dashboard.json", "test-ref", "msg")
		rw.AssertCalled(t, "Create", mock.Anything, "new-folder/dashboard.json", "test-ref", data, "msg")
		rw.AssertNotCalled(t, "Move", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("rename move into new folder writes _folder.json then moves", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "new-folder/", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "new-folder/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg").
			Return(nil)
		rw.On("Move", mock.Anything, "old-folder/dashboard.json", "new-folder/dashboard.json", "test-ref", "msg").Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		opts := DualWriteOptions{
			OriginalPath: "old-folder/dashboard.json",
			Path:         "new-folder/dashboard.json",
			Ref:          "test-ref",
			Message:      "msg",
		}
		err := dw.moveResourceAndCreateNewFolderMetadata(context.Background(), opts, data)(rw, false)

		require.NoError(t, err)
		rw.AssertCalled(t, "Create", mock.Anything, "new-folder/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")
		rw.AssertCalled(t, "Move", mock.Anything, "old-folder/dashboard.json", "new-folder/dashboard.json", "test-ref", "msg")
	})

	t.Run("move into existing folder does not write _folder.json", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "existing-folder/", "test-ref").
			Return(&repository.FileInfo{Path: "existing-folder/"}, nil)
		rw.On("Move", mock.Anything, "old-folder/dashboard.json", "existing-folder/dashboard.json", "test-ref", "msg").Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: true}
		opts := DualWriteOptions{
			OriginalPath: "old-folder/dashboard.json",
			Path:         "existing-folder/dashboard.json",
			Ref:          "test-ref",
			Message:      "msg",
		}
		err := dw.moveResourceAndCreateNewFolderMetadata(context.Background(), opts, data)(rw, false)

		require.NoError(t, err)
		rw.AssertNotCalled(t, "Create", mock.Anything, "existing-folder/_folder.json", mock.Anything, mock.Anything, mock.Anything)
		rw.AssertCalled(t, "Move", mock.Anything, "old-folder/dashboard.json", "existing-folder/dashboard.json", "test-ref", "msg")
	})

	t.Run("flag disabled moves without writing _folder.json", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Move", mock.Anything, "old-folder/dashboard.json", "new-folder/dashboard.json", "test-ref", "msg").Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
		dw := &DualReadWriter{repo: rw, folders: fm, folderMetadataEnabled: false}
		opts := DualWriteOptions{
			OriginalPath: "old-folder/dashboard.json",
			Path:         "new-folder/dashboard.json",
			Ref:          "test-ref",
			Message:      "msg",
		}
		err := dw.moveResourceAndCreateNewFolderMetadata(context.Background(), opts, data)(rw, false)

		require.NoError(t, err)
		rw.AssertNotCalled(t, "Read", mock.Anything, mock.Anything, mock.Anything)
		rw.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		rw.AssertCalled(t, "Move", mock.Anything, "old-folder/dashboard.json", "new-folder/dashboard.json", "test-ref", "msg")
	})
}

// TestDualReadWriter_ReadNewResourcePreviewWithTokenAuth exercises previews of new
// resources whose folders have not been synced to Grafana. It uses the real parser,
// authorizer, and token checker with mocked storage and ancestor-scoped grants.
// Token auth prevents the Editor role fallback from masking authorization failures.
// The cases cover branch and folder-metadata variants, allowing or denying previews
// according to ancestor permissions while preserving the caller identity and the
// resource's destination folder. Preview reads must not persist any changes.
func TestDualReadWriter_ReadNewResourcePreviewWithTokenAuth(t *testing.T) {
	forEachPreviewResource(t, testReadNewResourcePreviewWithTokenAuth)
}

func testReadNewResourcePreviewWithTokenAuth(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
	t.Helper()
	resourceName := "preview-" + resource.Resource
	for _, tt := range []struct {
		name                  string
		path                  string
		ref                   string
		folderMetadata        bool
		metadataOnlyOnFeature bool
		canReadAncestor       bool
	}{
		{name: "feature branch with one missing hash folder", path: "new/dashboard.json", ref: "feature", canReadAncestor: true},
		{name: "feature branch with multiple missing hash folders", path: "new/nested/dashboard.json", ref: "feature", canReadAncestor: true},
		{name: "feature branch with one missing metadata folder", path: "new/dashboard.json", ref: "feature", folderMetadata: true, canReadAncestor: true},
		{name: "feature branch with multiple missing metadata folders", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true, canReadAncestor: true},
		{name: "folder metadata exists only on feature branch", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true, metadataOnlyOnFeature: true, canReadAncestor: true},
		{name: "configured branch awaiting sync", path: "new/nested/dashboard.json", ref: "main", folderMetadata: true, canReadAncestor: true},
		{name: "empty ref uses configured branch", path: "new/dashboard.json", canReadAncestor: true},
		{name: "hash folder ancestor permission denied", path: "new/nested/dashboard.json", ref: "feature"},
		{name: "metadata folder ancestor permission denied", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-dashboards", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			}
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(mock.Anything, tt.path, tt.ref).Return(&repository.FileInfo{
				Path: tt.path,
				Ref:  tt.ref,
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Preview resource"}}`, kind.GroupVersion().String(), kind.Kind, resourceName)),
			}, nil).Once()

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})

			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			var destination string
			for dir := safepath.Dir(tt.path); dir != ""; dir = safepath.Dir(dir) {
				folderID := ParseFolder(dir, cfg.Name).ID
				if tt.folderMetadata {
					folderID = "stable-" + safepath.Base(dir)
					metadataPath := safepath.Join(dir, folderMetadataFileName)
					file := &repository.FileInfo{Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, folderID))}
					if destination == "" {
						repo.EXPECT().Read(mock.Anything, metadataPath, tt.ref).Return(file, nil).Once()
					}
					if tt.metadataOnlyOnFeature {
						repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(nil, repository.ErrFileNotFound).Once()
					} else {
						repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(file, nil).Once()
					}
				}
				if destination == "" {
					destination = folderID
				}
				if tt.metadataOnlyOnFeature {
					folderID = ParseFolder(dir, cfg.Name).ID
				}
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
			}
			folders.On("Get", provisioningContext, cfg.Name, metav1.GetOptions{}, mock.Anything).
				Return(newManagedAncestorFolder(t, cfg, cfg.Name, ""), nil).Once()

			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(resource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()

			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: FolderKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo: provisioning.ResourceRepositoryInfo{
					Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type,
				},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: tt.folderMetadata,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.NotNil(t, storage.FromContext(checkCtx))
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource,
					Verb: utils.VerbGet, Name: resourceName,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				return authlib.CheckResponse{Allowed: tt.canReadAncestor && folder == cfg.Name}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(tt.folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, tt.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, tt.folderMetadata)

			parsed, err := readWriter.Read(ctx, tt.path, tt.ref)
			if tt.canReadAncestor {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Nil(t, parsed.Existing)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, destination, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, destination, meta.GetFolder())
			assert.Equal(t, []string{cfg.Name}, checkedFolders)
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadPreviewAtRoot(t *testing.T) {
	for _, target := range []provisioning.SyncTargetType{provisioning.SyncTargetTypeInstance, provisioning.SyncTargetTypeFolderless} {
		t.Run(string(target), func(t *testing.T) {
			forEachPreviewResource(t, func(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
				testReadPreviewAtRoot(t, kind, resource, target)
			})
			t.Run("Folder", func(t *testing.T) {
				testReadPreviewAtRoot(t, FolderKind, FolderResource, target)
			})
		})
	}
}

func testReadPreviewAtRoot(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource, target provisioning.SyncTargetType) {
	t.Helper()
	for _, tt := range []struct {
		name        string
		newChecker  func(authlib.AccessChecker) auth.AccessChecker
		role        identity.RoleType
		rootAllowed bool
		wantAllowed bool
	}{
		{name: "token permits root", newChecker: auth.NewTokenAccessChecker, role: identity.RoleNone, rootAllowed: true, wantAllowed: true},
		{name: "token denies root without role fallback", newChecker: auth.NewTokenAccessChecker, role: identity.RoleViewer},
		{name: "session permits root", newChecker: auth.NewSessionAccessChecker, role: identity.RoleNone, rootAllowed: true, wantAllowed: true},
		{name: "session denies root without matching role", newChecker: auth.NewSessionAccessChecker, role: identity.RoleNone},
		{name: "session viewer fallback permits root", newChecker: auth.NewSessionAccessChecker, role: identity.RoleViewer, wantAllowed: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "root-preview", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: target},
				},
			}
			resourceName := "root-" + resource.Resource
			resourcePath := "new/nested/resource.json"
			folderMetadata := resource == FolderResource
			if folderMetadata {
				resourcePath = "new/nested/_folder.json"
			}
			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: tt.role}
			ctx := identity.WithRequester(context.Background(), caller)
			callerContext := mock.MatchedBy(func(readCtx context.Context) bool {
				id, err := identity.GetRequester(readCtx)
				return err == nil && id == caller
			})
			provisioningContext := mock.MatchedBy(func(lookupCtx context.Context) bool {
				id, err := identity.GetRequester(lookupCtx)
				return err == nil && identity.IsProvisioningServiceIdentity(id) && id.GetNamespace() == cfg.Namespace
			})
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(callerContext, resourcePath, "feature").Return(&repository.FileInfo{
				Path: resourcePath, Ref: "feature",
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Root preview"}}`, kind.GroupVersion().String(), kind.Kind, resourceName)),
			}, nil).Once()
			if folderMetadata {
				repo.EXPECT().Read(callerContext, "new/_folder.json", "feature").Return(nil, repository.ErrFileNotFound).Once()
			}
			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			var probedFolders []string
			for _, dir := range []string{"new/nested/", "new/"} {
				if folderMetadata {
					repo.EXPECT().Read(callerContext, safepath.Join(dir, folderMetadataFileName), "").Return(nil, repository.ErrFileNotFound).Once()
				}
				folderID := ParseFolder(dir, cfg.Name).ID
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Run(func(args mock.Arguments) { probedFolders = append(probedFolders, args.String(1)) }).
					Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
			}
			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(resource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(callerContext, kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: folderMetadata,
			}
			var checkedFolders []string
			access := tt.newChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, caller, id)
				require.NotNil(t, storage.FromContext(checkCtx))
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource, Name: resourceName, Verb: utils.VerbGet,
				}, req, "root authorization must retain the resource name, including Folder previews")
				require.Empty(t, folder)
				require.Equal(t, []string{ParseFolder("new/nested/", cfg.Name).ID, ParseFolder("new/", cfg.Name).ID}, probedFolders)
				checkedFolders = append(checkedFolders, folder)
				return authlib.CheckResponse{Allowed: tt.rootAllowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, folderMetadata)

			parsed, err := readWriter.Read(ctx, resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				require.Nil(t, parsed.Existing)
				require.Nil(t, parsed.Upsert)
			} else {
				require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				require.Nil(t, parsed)
			}
			require.Equal(t, []string{""}, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			destinationPath := safepath.Dir(resourcePath)
			if folderMetadata {
				destinationPath = safepath.Dir(destinationPath)
			}
			require.Equal(t, ParseFolder(destinationPath, cfg.Name).ID, meta.GetFolder(), "root authorization must preserve the unsynced destination")
			require.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			require.Len(t, folders.Calls, 2, "preview probes directories without creating or probing a root folder")
			for _, call := range repo.Calls {
				require.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadRejectsReadableUnmanagedAncestor(t *testing.T) {
	const resourcePath = "team/new/dashboard.json"
	const resourceName = "decoy-preview-dashboard"
	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "decoy-preview-repo", Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitRepositoryType,
			Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
			Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
	}
	repo := repository.NewMockReaderWriter(t)
	repo.EXPECT().Config().Return(cfg)
	repo.EXPECT().Read(mock.Anything, resourcePath, "feature").Return(&repository.FileInfo{
		Path: resourcePath, Ref: "feature",
		Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Decoy preview"}}`, DashboardKind.GroupVersion().String(), DashboardKind.Kind, resourceName)),
	}, nil).Once()
	caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
	ctx := authlib.WithAuthInfo(context.Background(), caller)
	_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
	require.NoError(t, err)
	provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
		id, ok := authlib.AuthInfoFrom(ctx)
		return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
	})
	decoyUID := ParseFolder(safepath.Dir(resourcePath), cfg.Name).ID
	decoy := &unstructured.Unstructured{}
	decoy.SetName(decoyUID)
	decoy.SetNamespace(cfg.Namespace)
	original := decoy.DeepCopy()
	folders := &MockDynamicResourceInterface{}
	t.Cleanup(func() { folders.AssertExpectations(t) })
	folders.On("Get", provisioningContext, decoyUID, metav1.GetOptions{}, mock.Anything).
		Return(decoy, nil).Once()
	resourceClient := &MockDynamicResourceInterface{}
	t.Cleanup(func() { resourceClient.AssertExpectations(t) })
	resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
		Return(nil, apierrors.NewNotFound(DashboardResource.GroupResource(), resourceName)).Once()
	resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
		}).Return(&unstructured.Unstructured{}, nil).Once()
	clients := NewMockResourceClients(t)
	clients.EXPECT().ForKind(mock.Anything, DashboardKind).Return(resourceClient, DashboardResource, nil).Once()
	clients.EXPECT().SupportedResources().Return([]SupportedResource{
		{GroupKind: DashboardKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
	}).Once()
	parser := &parser{
		repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
		reader: repo, config: cfg, clients: clients,
	}
	var checkedFolders []string
	access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(_ context.Context, id authlib.AuthInfo, _ authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
		require.Same(t, caller, id)
		checkedFolders = append(checkedFolders, folder)
		return authlib.CheckResponse{Allowed: folder == decoyUID}, nil
	})).WithFallbackRole(identity.RoleViewer)
	fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind)
	authorizer := NewAuthorizer(cfg, repo, access, clients, fm, false)
	readWriter := NewDualReadWriter(repo, parser, nil, authorizer, false)

	parsed, err := readWriter.Read(ctx, resourcePath, "feature")
	require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
	require.Nil(t, parsed)
	require.Empty(t, checkedFolders, "an unmanaged decoy must not be used for authorization")
	require.Equal(t, original, decoy, "preview must not claim the unmanaged folder")
	require.Len(t, folders.Calls, 1, "an ownership conflict must stop the ancestor lookup")
	require.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
	for _, call := range repo.Calls {
		require.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
	}
}

// PR metadata must not select the folder used for authorization; only the
// configured branch's nearest existing folder controls access.
func TestDualReadWriter_ReadNewResourcePreviewValidatesConfiguredFolder(t *testing.T) {
	forEachPreviewResource(t, testReadNewResourcePreviewValidatesConfiguredFolder)
}

func testReadNewResourcePreviewValidatesConfiguredFolder(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
	t.Helper()
	resourceName := "preview-" + resource.Resource
	for _, tt := range []struct {
		name              string
		path              string
		target            provisioning.SyncTargetType
		folderMetadata    bool
		unsynced          bool
		configuredFolder  string
		denyDestination   bool
		canReadConfigured bool
		ancestorExists    bool
		canReadAncestor   bool
		wantAllowed       bool
	}{
		{name: "allowed PR folder cannot bypass denied configured folder", folderMetadata: true, configuredFolder: "restricted-folder"},
		{name: "different allowed configured folder permits preview", folderMetadata: true, configuredFolder: "other-allowed-folder", canReadConfigured: true, wantAllowed: true},
		{name: "denied PR folder cannot override allowed configured folder", folderMetadata: true, configuredFolder: "other-allowed-folder", denyDestination: true, canReadConfigured: true, wantAllowed: true},
		{name: "matching allowed folder permits preview", folderMetadata: true, configuredFolder: "preview-folder", wantAllowed: true},
		{name: "missing hash folder requires instance root permission", target: provisioning.SyncTargetTypeInstance, unsynced: true, canReadConfigured: true},
		{name: "missing repository root before folder sync forbids preview", path: "dashboard.json", unsynced: true, canReadConfigured: true},
		{name: "matching allowed metadata folder requires ancestor permission", folderMetadata: true, configuredFolder: "preview-folder", unsynced: true, ancestorExists: true},
		{name: "matching allowed metadata folder inherits from allowed ancestor", folderMetadata: true, configuredFolder: "preview-folder", unsynced: true, ancestorExists: true, canReadAncestor: true, wantAllowed: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			resourcePath := tt.path
			if resourcePath == "" {
				resourcePath = "team/resource.json"
			}
			const metadataPath = "team/_folder.json"
			target := tt.target
			if target == "" {
				target = provisioning.SyncTargetTypeFolder
			}
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-dashboards", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: target},
				},
			}
			destination := "preview-folder"
			configuredFolder := tt.configuredFolder
			if !tt.folderMetadata {
				destination = ParentFolder(resourcePath, cfg)
				configuredFolder = destination
			}
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(mock.Anything, resourcePath, "feature").Return(&repository.FileInfo{
				Path: resourcePath, Ref: "feature",
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Preview resource"}}`, kind.GroupVersion().String(), kind.Kind, resourceName)),
			}, nil).Once()
			if tt.folderMetadata {
				repo.EXPECT().Read(mock.Anything, metadataPath, "feature").Return(&repository.FileInfo{
					Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, destination)),
				}, nil).Once()
				repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(&repository.FileInfo{
					Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, configuredFolder)),
				}, nil).Once()
			}

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})
			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			probedFolderIDs := []string{configuredFolder}
			if tt.unsynced && safepath.Dir(resourcePath) != "" && target == provisioning.SyncTargetTypeFolder {
				probedFolderIDs = append(probedFolderIDs, cfg.Name)
			}
			for _, folderID := range probedFolderIDs {
				folderExists := !tt.unsynced || (folderID == cfg.Name && tt.ancestorExists)
				if !folderExists {
					folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
						Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
					continue
				}
				folderPath := safepath.Dir(resourcePath)
				if folderID == cfg.Name {
					folderPath = ""
				}
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Return(newManagedAncestorFolder(t, cfg, folderID, folderPath), nil).Once()
			}

			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(resource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: FolderKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: tt.folderMetadata,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.NotNil(t, storage.FromContext(checkCtx))
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource,
					Verb: utils.VerbGet, Name: resourceName,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				allowed := (!tt.denyDestination && folder == destination) ||
					(tt.canReadConfigured && folder == configuredFolder) ||
					(tt.canReadAncestor && folder == cfg.Name)
				return authlib.CheckResponse{Allowed: allowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(tt.folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, tt.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, tt.folderMetadata)

			parsed, err := readWriter.Read(ctx, resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Nil(t, parsed.Existing)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, destination, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			var checkedFolderIDs []string
			if !tt.unsynced {
				checkedFolderIDs = append(checkedFolderIDs, configuredFolder)
			} else if tt.ancestorExists {
				checkedFolderIDs = append(checkedFolderIDs, cfg.Name)
			} else if target == provisioning.SyncTargetTypeInstance {
				checkedFolderIDs = append(checkedFolderIDs, "")
			}
			assert.Equal(t, checkedFolderIDs, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, destination, meta.GetFolder())
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadNewFolderPreviewUsesParentAncestors(t *testing.T) {
	for _, tt := range []struct {
		name          string
		parentExists  bool
		canReadParent bool
		rootExists    bool
		canReadRoot   bool
		wantAllowed   bool
	}{
		{name: "allowed existing parent permits preview", parentExists: true, canReadParent: true, wantAllowed: true},
		{name: "denied existing parent forbids preview", parentExists: true},
		{name: "allowed real root permits preview", rootExists: true, canReadRoot: true, wantAllowed: true},
		{name: "denied real root forbids preview", rootExists: true},
		{name: "missing parent and root forbid preview"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			const resourcePath = "team/new/_folder.json"
			const parentMetadataPath = "team/_folder.json"
			const resourceName = "preview-folder"
			const parentFolder = "parent-folder"
			const decoyFolder = "allowed-decoy"
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-resources", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			}
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(mock.Anything, resourcePath, "feature").Return(&repository.FileInfo{
				Path: resourcePath, Ref: "feature",
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Preview folder"}}`, FolderKind.GroupVersion().String(), FolderKind.Kind, resourceName)),
			}, nil).Once()
			parentMetadata := &repository.FileInfo{
				Path: parentMetadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, parentFolder)),
			}
			repo.EXPECT().Read(mock.Anything, parentMetadataPath, "feature").Return(parentMetadata, nil).Once()
			repo.EXPECT().Read(mock.Anything, resourcePath, "").Return(nil, repository.ErrFileNotFound).Once()
			repo.EXPECT().Read(mock.Anything, parentMetadataPath, "").Return(parentMetadata, nil).Once()

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})
			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			folderID := ParseFolder(safepath.Dir(resourcePath), cfg.Name).ID
			folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
			if tt.parentExists {
				folders.On("Get", provisioningContext, parentFolder, metav1.GetOptions{}, mock.Anything).
					Return(newManagedAncestorFolder(t, cfg, parentFolder, "team/"), nil).Once()
			} else {
				folders.On("Get", provisioningContext, parentFolder, metav1.GetOptions{}, mock.Anything).
					Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), parentFolder)).Once()
				if tt.rootExists {
					folders.On("Get", provisioningContext, cfg.Name, metav1.GetOptions{}, mock.Anything).
						Return(newManagedAncestorFolder(t, cfg, cfg.Name, ""), nil).Once()
				} else {
					folders.On("Get", provisioningContext, cfg.Name, metav1.GetOptions{}, mock.Anything).
						Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), cfg.Name)).Once()
				}
			}
			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), FolderKind).Return(resourceClient, FolderResource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: FolderKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: true,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.NotNil(t, storage.FromContext(checkCtx))
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: FolderResource.Group, Resource: FolderResource.Resource,
					Verb: utils.VerbGet, Name: folder,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				allowed := req.Name == decoyFolder ||
					(tt.canReadParent && req.Name == parentFolder) ||
					(tt.canReadRoot && req.Name == cfg.Name)
				return authlib.CheckResponse{Allowed: allowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, true)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, true)

			parsed, err := readWriter.Read(ctx, resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Nil(t, parsed.Existing)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, parentFolder, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			var checkedFolderIDs []string
			if tt.parentExists {
				checkedFolderIDs = append(checkedFolderIDs, parentFolder)
			} else if tt.rootExists {
				checkedFolderIDs = append(checkedFolderIDs, cfg.Name)
			}
			assert.Equal(t, checkedFolderIDs, checkedFolders)
			folders.AssertNotCalled(t, "Get", mock.Anything, decoyFolder, metav1.GetOptions{}, mock.Anything)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, parentFolder, meta.GetFolder())
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadMovedResourcePreviewWithTokenAuth(t *testing.T) {
	forEachPreviewResource(t, testReadMovedResourcePreviewWithTokenAuth)
	t.Run("Folder", func(t *testing.T) {
		testReadMovedResourcePreviewWithTokenAuth(t, FolderKind, FolderResource)
	})
}

type movedResourcePreviewCase struct {
	name                  string
	folderMetadata        bool
	metadataOnlyOnFeature bool
	configuredFolder      string
	canReadSource         bool
	canReadAncestor       bool
	noAncestor            bool
	sameFolder            bool
	sourceMatchesAncestor bool
	wantAllowed           bool
}

type movedResourcePreviewFixture struct {
	isFolder              bool
	folderMetadata        bool
	resourceName          string
	resourcePath          string
	sourcePath            string
	sourceFolder          string
	destination           string
	ancestor              string
	configuredDestination string
	resolvedFolder        string
	checkSource           bool
	lookupAncestors       bool
}

func newMovedResourcePreviewFixture(tt movedResourcePreviewCase, resource schema.GroupVersionResource, repoName string) movedResourcePreviewFixture {
	f := movedResourcePreviewFixture{
		isFolder:       resource == FolderResource,
		folderMetadata: tt.folderMetadata || resource == FolderResource,
		resourceName:   "existing-" + resource.Resource,
		resourcePath:   "team/renamed/resource.json",
		sourcePath:     "team/original/resource.json",
		sourceFolder:   ParseFolder("team/original/", repoName).ID,
		destination:    ParseFolder("team/renamed/", repoName).ID,
		ancestor:       ParseFolder("team/", repoName).ID,
	}
	if f.isFolder {
		f.resourcePath = "team/renamed/child/_folder.json"
		f.sourcePath = "team/original/child/_folder.json"
	}
	if f.folderMetadata {
		f.sourceFolder, f.destination = "source-folder", "destination-folder"
		if !tt.metadataOnlyOnFeature {
			f.ancestor = "team-folder"
		}
	}
	if tt.sameFolder {
		f.sourceFolder = f.destination
		f.sourcePath = "team/renamed/previous.json"
		if f.isFolder {
			f.sourcePath = "team/renamed/previous/_folder.json"
		}
	}
	if tt.sourceMatchesAncestor {
		f.sourceFolder = f.ancestor
		f.sourcePath = "team/resource.json"
		if f.isFolder {
			f.sourcePath = "team/child/_folder.json"
		}
	}
	f.configuredDestination = f.destination
	if tt.metadataOnlyOnFeature {
		f.configuredDestination = ParseFolder("team/renamed/", repoName).ID
	} else if tt.configuredFolder != "" {
		f.configuredDestination = tt.configuredFolder
	}
	f.resolvedFolder = f.ancestor
	if tt.sameFolder {
		f.resolvedFolder = f.configuredDestination
		if f.isFolder && tt.configuredFolder == "" {
			f.resolvedFolder = f.resourceName
		}
	}
	f.checkSource = f.sourceFolder != f.destination
	f.lookupAncestors = !f.checkSource || tt.canReadSource
	return f
}

func (f movedResourcePreviewFixture) expectRepositoryReads(t *testing.T, tt movedResourcePreviewCase, cfg *provisioning.Repository, kind schema.GroupVersionKind) *repository.MockReaderWriter {
	t.Helper()
	repo := repository.NewMockReaderWriter(t)
	repo.EXPECT().Config().Return(cfg).Maybe()
	repo.EXPECT().Read(mock.Anything, f.resourcePath, "feature").Return(&repository.FileInfo{
		Path: f.resourcePath, Ref: "feature",
		Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Moved resource"}}`, kind.GroupVersion().String(), kind.Kind, f.resourceName)),
	}, nil).Once()
	if !f.folderMetadata {
		return repo
	}

	metadataPath := "team/renamed/_folder.json"
	metadata := &repository.FileInfo{Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.destination))}
	repo.EXPECT().Read(mock.Anything, metadataPath, "feature").Return(metadata, nil).Once()
	if !f.lookupAncestors {
		return repo
	}

	if f.isFolder {
		if tt.sameFolder {
			repo.EXPECT().Read(mock.Anything, f.resourcePath, "").Return(&repository.FileInfo{
				Path: f.resourcePath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.resolvedFolder)),
			}, nil).Once()
		} else {
			repo.EXPECT().Read(mock.Anything, f.resourcePath, "").Return(nil, repository.ErrFileNotFound).Once()
		}
	}
	if !f.isFolder || !tt.sameFolder {
		if tt.metadataOnlyOnFeature {
			repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(nil, repository.ErrFileNotFound).Once()
		} else {
			repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(&repository.FileInfo{
				Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.configuredDestination)),
			}, nil).Once()
		}
	}
	if !tt.sameFolder {
		if tt.metadataOnlyOnFeature {
			repo.EXPECT().Read(mock.Anything, "team/_folder.json", "").Return(nil, repository.ErrFileNotFound).Once()
		} else {
			repo.EXPECT().Read(mock.Anything, "team/_folder.json", "").Return(&repository.FileInfo{
				Path: "team/_folder.json", Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.ancestor)),
			}, nil).Once()
		}
	}
	return repo
}

func (f movedResourcePreviewFixture) expectFolderProbes(t *testing.T, tt movedResourcePreviewCase, cfg *provisioning.Repository, provisioningContext interface{}, checkedFolders *[]string) *MockDynamicResourceInterface {
	t.Helper()
	folders := &MockDynamicResourceInterface{}
	t.Cleanup(func() { folders.AssertExpectations(t) })
	var probedFolders []string
	if f.lookupAncestors {
		if f.isFolder && tt.sameFolder {
			probedFolders = append(probedFolders, f.resolvedFolder)
		} else {
			if f.isFolder {
				probedFolders = append(probedFolders, ParseFolder(safepath.Dir(f.resourcePath), cfg.Name).ID)
			}
			probedFolders = append(probedFolders, f.configuredDestination)
		}
		if !tt.sameFolder {
			probedFolders = append(probedFolders, f.ancestor)
		}
		if tt.noAncestor {
			probedFolders = append(probedFolders, cfg.Name)
		}
	}
	for _, folderID := range probedFolders {
		checkOrder := func(mock.Arguments) {
			if f.checkSource {
				require.Equal(t, []string{f.sourceFolder}, *checkedFolders, "authorize the existing resource before probing ancestors")
			} else {
				require.Empty(t, *checkedFolders, "resolve the configured ancestor before checking same-folder access")
			}
		}
		folderExists := !tt.noAncestor && folderID == f.resolvedFolder
		if !folderExists {
			folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
				Run(checkOrder).Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
		} else {
			folderPath := "team/"
			if tt.sameFolder {
				folderPath = safepath.Dir(f.resourcePath)
			}
			folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
				Run(checkOrder).
				Return(newManagedAncestorFolder(t, cfg, folderID, folderPath), nil).Once()
		}
	}
	return folders
}

func testReadMovedResourcePreviewWithTokenAuth(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
	t.Helper()
	isFolder := resource == FolderResource
	for _, tt := range []movedResourcePreviewCase{
		{name: "directory rename inherits allowed hash ancestor", canReadSource: true, canReadAncestor: true, wantAllowed: true},
		{name: "directory rename respects denied hash ancestor", canReadSource: true},
		{name: "directory rename requires source permission", canReadAncestor: true},
		{name: "metadata move inherits allowed ancestor", folderMetadata: true, canReadSource: true, canReadAncestor: true, wantAllowed: true},
		{name: "metadata move respects denied ancestor", folderMetadata: true, canReadSource: true},
		{name: "metadata move requires source permission", folderMetadata: true, canReadAncestor: true},
		{name: "feature-only metadata uses configured hash ancestor", folderMetadata: true, metadataOnlyOnFeature: true, canReadSource: true, canReadAncestor: true, wantAllowed: true},
		{name: "move without any real ancestor is forbidden", canReadSource: true, canReadAncestor: true, noAncestor: true},
		{name: "same-folder rename retains original resource check", folderMetadata: true, canReadSource: true, sameFolder: true, wantAllowed: true},
		{name: "same-folder rename respects denied resource permission", folderMetadata: true, sameFolder: true},
		{name: "same-folder PR metadata cannot bypass denied configured folder", folderMetadata: true, configuredFolder: "restricted-folder", canReadSource: true, sameFolder: true},
		{name: "same-folder PR metadata permits allowed configured folder", folderMetadata: true, configuredFolder: "other-allowed-folder", canReadSource: true, canReadAncestor: true, sameFolder: true, wantAllowed: true},
		{name: "source folder is the nearest configured ancestor", folderMetadata: true, canReadSource: true, canReadAncestor: true, sourceMatchesAncestor: true, wantAllowed: true},
	} {
		if isFolder && !tt.folderMetadata && !tt.noAncestor {
			continue // Folder manifests require folder metadata support.
		}
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-resources", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			}
			f := newMovedResourcePreviewFixture(tt, resource, cfg.Name)
			repo := f.expectRepositoryReads(t, tt, cfg, kind)

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})
			var checkedFolders []string
			folders := f.expectFolderProbes(t, tt, cfg, provisioningContext, &checkedFolders)

			existing := &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": f.resourceName, "namespace": cfg.Namespace, "resourceVersion": "42"},
			}}
			existingMeta, err := utils.MetaAccessor(existing)
			require.NoError(t, err)
			existingMeta.SetFolder(f.sourceFolder)
			existingMeta.SetSourceProperties(utils.SourceProperties{Path: f.sourcePath})
			existingMeta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: cfg.Name})
			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, f.resourceName, metav1.GetOptions{}, mock.Anything).
				Return(existing, nil).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Update", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.UpdateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: f.folderMetadata,
			}
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.NotNil(t, storage.FromContext(checkCtx))
				require.Same(t, caller, id)
				name := f.resourceName
				if f.isFolder && (!f.checkSource && f.resourceName == f.resolvedFolder || len(checkedFolders) > 0) {
					name = folder
				}
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource,
					Verb: utils.VerbGet, Name: name,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				allowed := (folder == f.sourceFolder && tt.canReadSource) || (folder == f.resolvedFolder && tt.canReadAncestor)
				if f.isFolder && req.Name == f.resourceName {
					allowed = tt.canReadSource
				}
				return authlib.CheckResponse{Allowed: allowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(f.folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, f.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, f.folderMetadata)

			parsed, err := readWriter.Read(ctx, f.resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Same(t, existing, parsed.Existing)
				assert.Equal(t, provisioning.ResourceActionUpdate, parsed.Action)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, f.destination, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			wantChecks := []string{f.sourceFolder}
			if f.isFolder && tt.sameFolder && tt.configuredFolder == "" {
				wantChecks = []string{f.resourceName}
			} else if tt.canReadSource && !tt.noAncestor && (!tt.sameFolder || f.configuredDestination != f.destination) {
				wantChecks = append(wantChecks, f.resolvedFolder)
			}
			assert.Equal(t, wantChecks, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, f.resourceName, dryRunObject.GetName())
			assert.Equal(t, "42", dryRunObject.GetResourceVersion())
			assert.Equal(t, f.destination, meta.GetFolder())
			assert.Equal(t, f.sourceFolder, existingMeta.GetFolder(), "preview must not mutate the existing resource")
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the existing resource and dry-runs its update")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func forEachPreviewResource(t *testing.T, run func(*testing.T, schema.GroupVersionKind, schema.GroupVersionResource)) {
	t.Helper()
	for _, resource := range []struct {
		kind     schema.GroupVersionKind
		resource schema.GroupVersionResource
	}{
		{kind: DashboardKind, resource: DashboardResource},
		{kind: dashboardv0.LibraryPanelResourceInfo.GroupVersionKind(), resource: dashboardv0.LibraryPanelResourceInfo.GroupVersionResource()},
		{
			kind:     schema.GroupVersionKind{Group: "example.grafana.app", Version: "v1alpha1", Kind: "Widget"},
			resource: schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
		},
	} {
		t.Run(resource.kind.Kind, func(t *testing.T) {
			run(t, resource.kind, resource.resource)
		})
	}
}

type previewTokenAccessChecker func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)

func (f previewTokenAccessChecker) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return f(ctx, id, req, folder)
}
