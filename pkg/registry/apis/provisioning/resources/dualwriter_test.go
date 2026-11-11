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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type readTestAuthorizer struct {
	Authorizer
	authorizeResource        func(context.Context, *ParsedResource, string) error
	authorizeResourcePreview func(context.Context, *ParsedResource) error
}

func (a readTestAuthorizer) AuthorizeResource(ctx context.Context, parsed *ParsedResource, verb string) error {
	return a.authorizeResource(ctx, parsed, verb)
}

func (a readTestAuthorizer) AuthorizeResourcePreview(ctx context.Context, parsed *ParsedResource) error {
	return a.authorizeResourcePreview(ctx, parsed)
}

func TestDualReadWriter_ReadAuthorizationDispatch(t *testing.T) {
	denied := apierrors.NewForbidden(DashboardResource.GroupResource(), "dashboard", assert.AnError)
	for _, tt := range []struct {
		name         string
		ref          string
		folder       bool
		action       provisioning.ResourceAction
		preview      bool
		authorizeErr error
	}{
		{name: "new resource preview", ref: "feature", action: provisioning.ResourceActionCreate, preview: true},
		{name: "existing resource preview", ref: "feature", action: provisioning.ResourceActionUpdate, preview: true},
		{name: "commit preview", ref: "0123456789012345678901234567890123456789", preview: true},
		{name: "configured branch", ref: "main"},
		{name: "implicit configured branch"},
		{name: "folder manifest on another branch", ref: "feature", folder: true},
		{name: "preview denial does not fall back", ref: "feature", preview: true, authorizeErr: denied},
		{name: "preview error does not fall back", ref: "feature", preview: true, authorizeErr: assert.AnError},
		{name: "ordinary read denial is preserved", ref: "main", authorizeErr: denied},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := t.Context()
			cfg := &provisioning.Repository{Spec: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType, Git: &provisioning.GitRepositoryConfig{Branch: "main"},
			}}
			info := &repository.FileInfo{Path: "team/dashboard.json", Ref: tt.ref}
			gvr := DashboardResource
			if tt.folder {
				info.Path = "team/_folder.json"
				gvr = FolderResource
			}
			rw := repository.NewMockReaderWriter(t)
			rw.EXPECT().Read(ctx, info.Path, tt.ref).Return(info, nil).Once()
			rw.EXPECT().Config().Return(cfg).Once()
			parsed := &ParsedResource{
				Info: info, GVR: gvr, Action: tt.action, DryRunResponse: &unstructured.Unstructured{},
			}
			parser := NewMockParser(t)
			parser.EXPECT().Parse(ctx, info).Return(parsed, nil).Once()
			checks := 0
			authorizer := readTestAuthorizer{
				authorizeResource: func(authCtx context.Context, resource *ParsedResource, verb string) error {
					require.False(t, tt.preview, "preview reads must use preview authorization")
					require.Equal(t, ctx, authCtx)
					require.Same(t, parsed, resource)
					require.Equal(t, utils.VerbGet, verb)
					checks++
					return tt.authorizeErr
				},
				authorizeResourcePreview: func(authCtx context.Context, resource *ParsedResource) error {
					require.True(t, tt.preview, "ordinary reads must use ordinary authorization")
					require.Equal(t, ctx, authCtx)
					require.Same(t, parsed, resource)
					checks++
					return tt.authorizeErr
				},
			}
			readWriter := NewDualReadWriter(rw, parser, nil, authorizer, false, 0)
			result, err := readWriter.Read(ctx, info.Path, tt.ref)
			require.Equal(t, 1, checks)
			if tt.authorizeErr != nil {
				require.ErrorIs(t, err, tt.authorizeErr)
				require.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.Same(t, parsed, result)
			}
			require.Equal(t, tt.action, parsed.Action)
		})
	}
}

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
			name: "writes _folder.json",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newTestRepoConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, repository.ErrFileNotFound)
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
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
			name: "error: WriteFolderMetadata fails",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.Anything, "").Return(fmt.Errorf("repo error"))
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
		},
		{
			name: "error: existing leaf without metadata returns AlreadyExists",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/", "").Return(&repository.FileInfo{}, nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
			},
		},
		{
			name: "error: read error other than not-found is propagated",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				rw := repository.NewMockReaderWriter(t)
				config := newTestRepoConfig("test-repo")
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, fmt.Errorf("network error"))
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), nil, false)}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			wantErr:     true,
			errContains: "check if folder exists",
		},
		{
			name: "ref not found falls back to configured branch, directory not found → creates on new branch",
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
				rw.On("Read", mock.Anything, "newfolder/", "new-branch").Return(nil, repository.ErrRefNotFound)
				// Fallback read targets the configured branch → directory not found either
				rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, repository.ErrFileNotFound)
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
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/", Ref: "new-branch"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "newfolder/", result.Path)
				assert.Equal(t, "new-branch", result.Ref)
			},
		},
		{
			name: "ref not found falls back to configured branch, directory exists without metadata → preserves ancestor",
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
				rw.On("Read", mock.Anything, "parent/", "new-branch").Return(nil, repository.ErrRefNotFound)
				rw.On("Read", mock.Anything, "parent/", "").
					Return(&repository.FileInfo{}, nil)
				rw.On("Read", mock.Anything, "parent/_folder.json", "").Return(nil, repository.ErrFileNotFound)

				// Child (leaf): branch doesn't exist → fallback → not found → create
				rw.On("Read", mock.Anything, "parent/child/", "new-branch").Return(nil, repository.ErrRefNotFound)
				rw.On("Read", mock.Anything, "parent/child/", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "parent/child/_folder.json", "new-branch", mock.MatchedBy(func(b []byte) bool {
					var f folders.Folder
					return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
				}), "").Return(nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
				return dw, DualWriteOptions{Path: "parent/child/", Ref: "new-branch"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.Equal(t, "parent/child/", result.Path)
				assert.Equal(t, "new-branch", result.Ref)
			},
		},
		{
			name: "ref not found falls back to configured branch, leaf exists without metadata → AlreadyExists",
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
				rw.On("Read", mock.Anything, "newfolder/", "new-branch").Return(nil, repository.ErrRefNotFound)
				rw.On("Read", mock.Anything, "newfolder/", "").
					Return(&repository.FileInfo{}, nil)

				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/", Ref: "new-branch"}
			},
			wantErr: true,
			errCheck: func(t *testing.T, err error) {
				assert.True(t, apierrors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
			},
		},
		{
			name: "sync enabled, full happy path → Upsert populated",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, repository.ErrFileNotFound)
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
				dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
				return dw, DualWriteOptions{Path: "newfolder/"}
			},
			check: func(t *testing.T, result *provisioning.ResourceWrapper) {
				assert.NotNil(t, result.Resource.Upsert.Object)
			},
		},
		{
			name: "sync enabled, CreateFolderWithUID error",
			setup: func(t *testing.T) (*DualReadWriter, DualWriteOptions) {
				config := newSyncEnabledConfig("test-repo")
				rw := repository.NewMockReaderWriter(t)
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, repository.ErrFileNotFound)
				rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.Anything, "").Return(nil)
				accessMock := auth.NewMockAccessChecker(t)
				accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				mockClient := &MockDynamicResourceInterface{}
				// EnsureFolderExists (CreateFolderWithUID): Get → non-NotFound error
				mockClient.On("Get", mock.Anything, mock.AnythingOfType("string"), metav1.GetOptions{}, []string(nil)).
					Return(nil, fmt.Errorf("server error")).Once()
				t.Cleanup(func() { mockClient.AssertExpectations(t) })

				fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
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
			name: "moves directory, no _folder.json written",
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
				expectMissingFolderMetadata(&rw.Mock)
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
				expectMissingFolderMetadata(&rw.Mock)
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
				expectMissingFolderMetadata(&rw.Mock)
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

func TestCreateFolder_DirectoryReadErrors(t *testing.T) {
	for _, tt := range []struct {
		name    string
		ref     string
		readErr error
		wantErr bool
	}{
		{name: "Kubernetes not found", readErr: apierrors.NewNotFound(schema.GroupResource{}, "newfolder/")},
		{name: "Kubernetes not found on configured branch", ref: "new-branch", readErr: apierrors.NewNotFound(schema.GroupResource{}, "newfolder/")},
		{name: "configured branch read fails", ref: "new-branch", readErr: assert.AnError, wantErr: true},
		{name: "configured branch also missing", ref: "new-branch", readErr: repository.ErrRefNotFound, wantErr: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			config := newTestRepoConfig("test-repo")
			config.Spec.Type = provisioning.GitRepositoryType
			config.Spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow}
			rw := repository.NewMockReaderWriter(t)
			rw.On("Config").Return(config)
			if tt.ref != "" {
				rw.On("Read", mock.Anything, "newfolder/", tt.ref).Return(nil, repository.ErrRefNotFound).Once()
			}
			rw.On("Read", mock.Anything, "newfolder/", "").Return(nil, tt.readErr).Once()
			if !tt.wantErr {
				rw.On("Create", mock.Anything, "newfolder/_folder.json", tt.ref, mock.Anything, "").Return(nil).Once()
			}
			accessMock := auth.NewMockAccessChecker(t)
			accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)
			fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
			dw := NewDualReadWriter(rw, nil, fm, NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), false)

			result, err := dw.CreateFolder(t.Context(), DualWriteOptions{Path: "newfolder/", Ref: tt.ref})
			if tt.wantErr {
				require.ErrorIs(t, err, tt.readErr)
				require.Nil(t, result)
				rw.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, result)
		})
	}
}

func TestCreateFolder_Nested_FolderMetadata(t *testing.T) {
	t.Run("nested folder creates _folder.json for every segment", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

		// Parent: not found → create
		rw.On("Read", mock.Anything, "parent/", "").Return(nil, repository.ErrFileNotFound)
		expectMissingFolderMetadata(&rw.Mock)
		rw.On("Create", mock.Anything, "parent/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "parent"
		}), "").Return(nil)

		// Child (leaf): not found → create
		rw.On("Read", mock.Anything, "parent/child/", "").Return(nil, repository.ErrFileNotFound)
		rw.On("Create", mock.Anything, "parent/child/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
		}), "").Return(nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
		result, err := dw.CreateFolder(context.Background(), DualWriteOptions{Path: "parent/child/"})

		require.NoError(t, err)
		require.NotNil(t, result)
		rw.AssertExpectations(t)
	})

	for _, hasMetadata := range []bool{false, true} {
		t.Run(fmt.Sprintf("skips existing parent with metadata=%t, creates child", hasMetadata), func(t *testing.T) {
			config := newTestRepoConfig("test-repo")
			rw := repository.NewMockReaderWriter(t)
			rw.On("Config").Return(config)
			accessMock := auth.NewMockAccessChecker(t)
			accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

			// Parent: already exists → skip (no Create call)
			rw.On("Read", mock.Anything, "parent/", "").Return(&repository.FileInfo{}, nil)
			if hasMetadata {
				existingParent := NewFolderManifest("existing-parent-uid", "parent", FolderKind)
				existingData, err := json.Marshal(existingParent)
				require.NoError(t, err)
				rw.On("Read", mock.Anything, "parent/_folder.json", "").
					Return(&repository.FileInfo{Data: existingData}, nil)
			} else {
				expectMissingFolderMetadata(&rw.Mock)
			}

			// Child: not found → create
			rw.On("Read", mock.Anything, "parent/child/", "").Return(nil, repository.ErrFileNotFound)
			rw.On("Create", mock.Anything, "parent/child/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
				var f folders.Folder
				return json.Unmarshal(b, &f) == nil && f.Name != "" && f.Spec.Title == "child"
			}), "").Return(nil)

			fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
			dw := &DualReadWriter{repo: rw, authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false), folders: fm}
			result, err := dw.CreateFolder(context.Background(), DualWriteOptions{Path: "parent/child/"})

			require.NoError(t, err)
			require.NotNil(t, result)
			rw.AssertExpectations(t)
			rw.AssertNotCalled(t, "Create", mock.Anything, "parent/_folder.json",
				mock.Anything, mock.Anything, mock.Anything)
		})
	}
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Config").Return(config)
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
				rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
					Return(&repository.FileInfo{Data: makeExistingData(t)}, nil).Once()
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
		dw := &DualReadWriter{repo: rw, folders: fm}
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
		dw := &DualReadWriter{repo: rw, folders: fm}
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
		dw := &DualReadWriter{repo: rw, folders: fm}
		err := dw.writeNewFoldersMetadata(context.Background(), rw, "a/b/dashboard.json", "test-ref", "msg")

		require.NoError(t, err)
		rw.AssertCalled(t, "Create", mock.Anything, "a/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")
		rw.AssertCalled(t, "Create", mock.Anything, "a/b/_folder.json", "test-ref", mock.AnythingOfType("[]uint8"), "msg")
	})

	t.Run("no-op for root-level file", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		dw := &DualReadWriter{repo: rw, folders: fm}
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
		dw := &DualReadWriter{repo: rw, folders: fm}
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
		dw := &DualReadWriter{repo: rw, folders: fm}
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
		dw := &DualReadWriter{repo: rw, folders: fm}
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
}

// stubAuthorizer satisfies Authorizer by embedding the interface and overriding only the two
// methods createOrUpdate exercises. Any other method would panic (nil embed) if called, which
// keeps the test honest about the write path it covers.
type stubAuthorizer struct{ Authorizer }

func (stubAuthorizer) AuthorizeWrite(context.Context, string) error { return nil }

func (stubAuthorizer) AuthorizeResource(context.Context, *ParsedResource, string) error { return nil }

// TestDualReadWriter_FolderScopeGuard verifies the write path stamps a grafana.app/folder
// annotation onto a resource living in a subdirectory only when the kind is folder-scoped.
// Org-scoped kinds (e.g. playlists) must never get one: their apiserver rejects it with
// "folders are not supported for playlists.playlist.grafana.app". This is the regression the
// FolderScoped gating in createOrUpdate prevents — before it, the dual writer re-stamped a
// folder onto every resource via EnsureFolderPathExist + SetFolder.
func TestDualReadWriter_FolderScopeGuard(t *testing.T) {
	const (
		repoName = "repo"
		subPath  = "team-a/resource.json"
	)

	playlistGVK := schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v1", Kind: "Playlist"}
	playlistGVR := schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v1", Resource: "playlists"}

	// The folder team-a/ resolves to, pre-seeded into the tree so EnsureFolderPathExist
	// returns it without having to create folders through a client.
	teamAFolder := ParseFolder("team-a/", repoName)

	newParsed := func(t *testing.T, folderScoped bool, client *MockDynamicResourceInterface) *ParsedResource {
		t.Helper()
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "playlist.grafana.app/v1",
			"kind":       "Playlist",
			"metadata":   map[string]any{"name": "res-1", "namespace": "default"},
			"spec":       map[string]any{"title": "Res"},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repoName})

		return &ParsedResource{
			Info:         &repository.FileInfo{Path: subPath},
			Obj:          obj,
			Meta:         meta,
			GVK:          playlistGVK,
			GVR:          playlistGVR,
			Client:       client,
			FolderScoped: folderScoped,
			Repo:         provisioning.ResourceRepositoryInfo{Name: repoName, Namespace: "default"},
			Action:       provisioning.ResourceActionUpdate,
			// Existing + DryRunResponse are pre-set so Run goes straight to the update call
			// (managed by the same repo, so the ownership check passes).
			Existing:       obj.DeepCopy(),
			DryRunResponse: obj.DeepCopy(),
		}
	}

	setup := func(t *testing.T, folderScoped bool) (*DualReadWriter, *ParsedResource, *repository.MockReaderWriter) {
		t.Helper()

		client := &MockDynamicResourceInterface{}
		client.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(&unstructured.Unstructured{}, nil)

		parsed := newParsed(t, folderScoped, client)

		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(newSyncEnabledConfig(repoName))
		rw.On("Update", mock.Anything, subPath, "", mock.Anything, "msg").Return(nil)
		rw.On("Read", mock.Anything, subPath, "").Return(&repository.FileInfo{Path: subPath, Hash: "h"}, nil)

		parser := NewMockParser(t)
		parser.On("Parse", mock.Anything, mock.Anything).Return(parsed, nil)

		tree := NewEmptyFolderTree()
		tree.Add(teamAFolder, "")
		expectMissingFolderMetadata(&rw.Mock)
		fm := NewFolderManager(rw, nil, tree, FolderKind)

		dw := NewDualReadWriter(rw, parser, fm, stubAuthorizer{}, false, 0)
		return dw, parsed, rw
	}

	t.Run("org-scoped resource is written without a folder annotation", func(t *testing.T) {
		dw, parsed, rw := setup(t, false)

		_, err := dw.UpdateResource(context.Background(), DualWriteOptions{
			Path:       subPath,
			Message:    "msg",
			SkipDryRun: true,
		})
		require.NoError(t, err)
		require.Empty(t, parsed.Meta.GetFolder(),
			"org-scoped resource must not have a folder annotation stamped onto it")
		// The folder resolution must be skipped entirely, so no _folder.json read happens.
		rw.AssertNotCalled(t, "Read", mock.Anything, "team-a/_folder.json", mock.Anything)
	})

	t.Run("folder-scoped resource is written with the resolved folder annotation", func(t *testing.T) {
		dw, parsed, _ := setup(t, true)

		_, err := dw.UpdateResource(context.Background(), DualWriteOptions{
			Path:       subPath,
			Message:    "msg",
			SkipDryRun: true,
		})
		require.NoError(t, err)
		require.Equal(t, teamAFolder.ID, parsed.Meta.GetFolder(),
			"folder-scoped resource must be parented to the resolved subdirectory folder")
	})
}

func TestKeepPlaintextSecureValues(t *testing.T) {
	secureObject := func(secure map[string]any) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
			"kind":       "DataSource",
			"metadata":   map[string]any{"name": "ds-1"},
			"spec":       map[string]any{"title": "DS"},
		}}
		if secure != nil {
			obj.Object["secure"] = secure
		}
		return obj
	}

	for _, tt := range []struct {
		name      string
		committed map[string]any
		updated   map[string]any
		want      map[string]any
	}{
		{
			name:      "a reference the update carries settles the key",
			committed: map[string]any{"password": map[string]any{"create": "hunter2"}},
			updated:   map[string]any{"password": map[string]any{"name": "inline-abc"}},
			want:      map[string]any{"password": map[string]any{"name": "inline-abc"}},
		},
		{
			name:      "missing key is restored",
			committed: map[string]any{"password": map[string]any{"create": "hunter2", "description": "db"}},
			updated:   nil,
			want:      map[string]any{"password": map[string]any{"create": "hunter2", "description": "db"}},
		},
		{
			name:      "a new plaintext wins",
			committed: map[string]any{"password": map[string]any{"create": "hunter2"}},
			updated:   map[string]any{"password": map[string]any{"create": "rotated"}},
			want:      map[string]any{"password": map[string]any{"create": "rotated"}},
		},
		{
			name:      "an explicit removal wins",
			committed: map[string]any{"password": map[string]any{"create": "hunter2"}},
			updated:   map[string]any{"password": map[string]any{"remove": true}},
			want:      map[string]any{"password": map[string]any{"remove": true}},
		},
		{
			name:      "a committed reference is not a secret to keep",
			committed: map[string]any{"password": map[string]any{"name": "shared-password"}},
			updated:   nil,
			want:      nil,
		},
		{
			name:      "other keys are left alone",
			committed: map[string]any{"password": map[string]any{"create": "hunter2"}},
			updated:   map[string]any{"token": map[string]any{"create": "t"}},
			want: map[string]any{
				"password": map[string]any{"create": "hunter2"},
				"token":    map[string]any{"create": "t"},
			},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			updated := secureObject(tt.updated)
			keepPlaintextSecureValues(secureObject(tt.committed), updated)
			if tt.want == nil {
				require.NotContains(t, updated.Object, "secure")
				return
			}
			require.Equal(t, tt.want, updated.Object["secure"])
		})
	}

	t.Run("a file replaced by a different resource does not inherit the secret", func(t *testing.T) {
		for _, tt := range []struct {
			name   string
			mutate func(*unstructured.Unstructured)
		}{
			{name: "different name", mutate: func(u *unstructured.Unstructured) { u.SetName("ds-2") }},
			{name: "different kind", mutate: func(u *unstructured.Unstructured) { u.SetKind("Playlist") }},
			{name: "different group", mutate: func(u *unstructured.Unstructured) {
				u.SetAPIVersion("playlist.grafana.app/v0alpha1")
			}},
		} {
			t.Run(tt.name, func(t *testing.T) {
				updated := secureObject(nil)
				tt.mutate(updated)
				keepPlaintextSecureValues(secureObject(map[string]any{
					"password": map[string]any{"create": "hunter2"},
				}), updated)
				require.NotContains(t, updated.Object, "secure")
			})
		}
	})

	t.Run("committed plaintext is copied, not shared", func(t *testing.T) {
		committed := secureObject(map[string]any{"password": map[string]any{"create": "hunter2"}})
		updated := secureObject(nil)
		keepPlaintextSecureValues(committed, updated)

		kept, ok := updated.Object["secure"].(map[string]any)["password"].(map[string]any)
		require.True(t, ok)
		kept["create"] = "mutated"
		require.Equal(t, "hunter2", committed.Object["secure"].(map[string]any)["password"].(map[string]any)["create"])
	})
}

// TestDualReadWriter_UpdateResourceKeepsCommittedSecureValues verifies that an update
// silent about a secure value does not drop the plaintext already committed in the file.
// The dry run is left enabled on purpose: the restore has to happen before it, so that
// what the apiserver validates is what the repository will hold.
func TestDualReadWriter_UpdateResourceKeepsCommittedSecureValues(t *testing.T) {
	const (
		repoName = "repo"
		path     = "datasource.json"
	)

	committed := &repository.FileInfo{Path: path, Hash: "h", Data: []byte(`{
		"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
		"kind": "DataSource",
		"metadata": {"name": "ds-1"},
		"spec": {"title": "DS"},
		"secure": {"password": {"create": "hunter2"}}
	}`)}

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
		"kind":       "DataSource",
		"metadata":   map[string]any{"name": "ds-1", "namespace": "default"},
		"spec":       map[string]any{"title": "DS renamed"},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repoName})

	// The live resource only ever exposes the reference; the update above says
	// nothing about the key at all.
	existing := obj.DeepCopy()
	require.NoError(t, unstructured.SetNestedStringMap(existing.Object, map[string]string{"name": "inline-abc"}, "secure", "password"))

	var dryRunObj, liveObj *unstructured.Unstructured
	client := &MockDynamicResourceInterface{}
	client.On("Get", mock.Anything, "ds-1", metav1.GetOptions{}, mock.Anything).Return(existing, nil)
	client.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).
		Run(func(args mock.Arguments) {
			written := args.Get(1).(*unstructured.Unstructured).DeepCopy()
			if len(args.Get(2).(metav1.UpdateOptions).DryRun) > 0 {
				dryRunObj = written
				return
			}
			liveObj = written
		})

	parsed := &ParsedResource{
		Info:   &repository.FileInfo{Path: path},
		Obj:    obj,
		Meta:   meta,
		GVK:    schema.GroupVersionKind{Group: "testdata.datasource.grafana.app", Version: "v0alpha1", Kind: "DataSource"},
		GVR:    schema.GroupVersionResource{Group: "testdata.datasource.grafana.app", Version: "v0alpha1", Resource: "datasources"},
		Client: client,
		Repo:   provisioning.ResourceRepositoryInfo{Name: repoName, Namespace: "default", Type: provisioning.LocalRepositoryType},
		Action: provisioning.ResourceActionUpdate,
	}

	var savedFile []byte
	rw := repository.NewMockReaderWriter(t)
	rw.On("Config").Return(newSyncEnabledConfig(repoName))
	rw.On("Read", mock.Anything, path, "").Return(committed, nil)
	rw.On("Update", mock.Anything, path, "", mock.Anything, "msg").Return(nil).
		Run(func(args mock.Arguments) {
			savedFile = args.Get(3).([]byte)
		})

	parser := NewMockParser(t)
	parser.On("Parse", mock.Anything, mock.Anything).Return(parsed, nil)

	dw := NewDualReadWriter(rw, parser, NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind), stubAuthorizer{}, false, 0)
	_, err = dw.UpdateResource(context.Background(), DualWriteOptions{
		Path:    path,
		Message: "msg",
	})
	require.NoError(t, err)

	keptSecure := map[string]any{"password": map[string]any{"create": "hunter2"}}

	var saved map[string]any
	require.NoError(t, json.Unmarshal(savedFile, &saved))
	require.Equal(t, keptSecure, saved["secure"], "the file must keep the plaintext it already had")

	require.NotNil(t, dryRunObj, "the dry run must have happened")
	require.Equal(t, keptSecure, dryRunObj.Object["secure"],
		"the restore must happen before the dry run, so the apiserver validates what the file will hold")
	require.NotNil(t, liveObj)
	require.Equal(t, keptSecure, liveObj.Object["secure"],
		"the resource update must carry the plaintext from the file")
}

func TestKeepCommittedSecureValues_ReadFallback(t *testing.T) {
	const path = "datasource.json"

	committed := &repository.FileInfo{Path: path, Data: []byte(`{
		"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
		"kind": "DataSource",
		"metadata": {"name": "ds-1"},
		"spec": {"title": "DS"},
		"secure": {"password": {"create": "hunter2"}}
	}`)}

	newParsed := func() *ParsedResource {
		return &ParsedResource{Obj: &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
			"kind":       "DataSource",
			"metadata":   map[string]any{"name": "ds-1"},
			"spec":       map[string]any{"title": "DS"},
		}}}
	}

	t.Run("a branch that does not exist yet falls back to the configured branch", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, path, "feature").Return(nil, repository.ErrRefNotFound)
		rw.On("Read", mock.Anything, path, "").Return(committed, nil)

		parsed := newParsed()
		dw := &DualReadWriter{repo: rw}
		require.NoError(t, dw.keepCommittedSecureValues(context.Background(), parsed, path, "feature"))
		require.Equal(t,
			map[string]any{"password": map[string]any{"create": "hunter2"}},
			parsed.Obj.Object["secure"])
	})

	t.Run("a new file has nothing to keep", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, path, "").Return(nil, repository.ErrFileNotFound)

		parsed := newParsed()
		dw := &DualReadWriter{repo: rw}
		require.NoError(t, dw.keepCommittedSecureValues(context.Background(), parsed, path, ""))
		require.NotContains(t, parsed.Obj.Object, "secure")
	})

	t.Run("an oversized committed file is replaceable", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, path, "").
			Return(nil, apierrors.NewRequestEntityTooLargeError("file is too big"))

		parsed := newParsed()
		dw := &DualReadWriter{repo: rw}
		require.NoError(t, dw.keepCommittedSecureValues(context.Background(), parsed, path, ""),
			"a file too large to read must not block the smaller replacement")
		require.NotContains(t, parsed.Obj.Object, "secure")
	})

	t.Run("a failed read fails the update", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, path, "").Return(nil, assert.AnError)

		dw := &DualReadWriter{repo: rw}
		require.ErrorIs(t, dw.keepCommittedSecureValues(context.Background(), newParsed(), path, ""), assert.AnError)
	})
}

func TestMoveFile_SecureValues(t *testing.T) {
	dashboardGVK := schema.GroupVersionKind{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
		Kind:    "Dashboard",
	}

	// Sync on the configured branch is what makes a move write to storage, so this
	// is the configuration in which an unguarded relocation would replay the
	// file's secure-value directives against the secret store.
	newSyncedGitRepo := func(t *testing.T) (*provisioning.Repository, *repository.MockReaderWriter) {
		config := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "default"},
			Spec: provisioning.RepositorySpec{
				Type:      provisioning.GitHubRepositoryType,
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				Sync:      provisioning.SyncOptions{Enabled: true},
				GitHub:    &provisioning.GitHubRepositoryConfig{Branch: "main"},
			},
		}
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config).Maybe()
		return config, rw
	}

	newDualWriter := func(t *testing.T, config *provisioning.Repository, rw *repository.MockReaderWriter, parser Parser) *DualReadWriter {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()
		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind)
		return &DualReadWriter{
			repo:       rw,
			parser:     parser,
			folders:    fm,
			authorizer: NewAuthorizer(config, rw, accessMock, authTestClients(t), fm, false),
		}
	}

	newParsed := func(t *testing.T, obj map[string]any, client *MockDynamicResourceInterface) *ParsedResource {
		u := &unstructured.Unstructured{Object: obj}
		meta, err := utils.MetaAccessor(u)
		require.NoError(t, err)
		parsed := &ParsedResource{
			Obj:  u,
			Meta: meta,
			GVK:  dashboardGVK,
			Repo: provisioning.ResourceRepositoryInfo{
				Name: "test-repo",
				Type: provisioning.GitHubRepositoryType,
			},
		}
		if client != nil {
			parsed.Client = client
		}
		return parsed
	}

	t.Run("a move that supplies no content is still rejected and writes nothing to storage", func(t *testing.T) {
		config, rw := newSyncedGitRepo(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}
		mockClient.On("Get", mock.Anything, "dash-uid", metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(DashboardResource.GroupResource(), "dash-uid")).Once()
		t.Cleanup(func() { mockClient.AssertExpectations(t) })

		poisoned := map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "dash-uid"},
			"secure":     map[string]any{"apiKey": map[string]any{"create": "super-secret"}},
		}

		originalFile := &repository.FileInfo{Data: []byte(`{}`), Path: "old/dash.json"}
		rw.On("Read", mock.Anything, "old/dash.json", "").Return(originalFile, nil)
		mockParser.On("Parse", mock.Anything, originalFile).Return(newParsed(t, poisoned, mockClient), nil)

		// No opts.Data: the destination carries the original file's content.
		mockParser.On("Parse", mock.Anything, &repository.FileInfo{
			Data: []byte(`{}`),
			Path: "new/dash.json",
		}).Return(newParsed(t, poisoned, mockClient), nil)

		dw := newDualWriter(t, config, rw, mockParser)
		_, err := dw.MoveResource(context.Background(), DualWriteOptions{
			OriginalPath: "old/dash.json",
			Path:         "new/dash.json",
			Message:      "move",
		})

		require.Error(t, err)
		require.ErrorIs(t, err, ErrSecureValuesNotAllowed)
		require.Contains(t, err.Error(), "cannot be created or removed from a github repository")
		require.NotContains(t, err.Error(), "super-secret")
		mockClient.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		mockClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		rw.AssertNotCalled(t, "Move", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	// A git repository cannot hold secure values at all, so a move must not carry the
	// committed plaintext into the destination: checkSecureValues would then reject
	// the very write that removes it, leaving the file unfixable through the API.
	t.Run("a content-bearing git move does not carry the committed plaintext", func(t *testing.T) {
		config, rw := newSyncedGitRepo(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}
		mockClient.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{Resource: "dashboards"}, "dash-uid")).Maybe()
		mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(&unstructured.Unstructured{}, nil).Maybe()

		committed := map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "dash-uid"},
			"secure":     map[string]any{"apiKey": map[string]any{"create": "super-secret"}},
		}
		// Same resource, and the move body says nothing about apiKey.
		moved := map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "dash-uid"},
			"spec":       map[string]any{"title": "Moved"},
		}

		originalFile := &repository.FileInfo{Data: []byte(`{}`), Path: "old/dash.json"}
		rw.On("Read", mock.Anything, "old/dash.json", "").Return(originalFile, nil)
		sourceParsed := newParsed(t, committed, mockClient)
		sourceParsed.Info = originalFile
		mockParser.On("Parse", mock.Anything, originalFile).Return(sourceParsed, nil)

		newContent := []byte(`{"moved":true}`)
		destinationInfo := &repository.FileInfo{Data: newContent, Path: "new/dash.json"}
		destinationParsed := newParsed(t, moved, mockClient)
		destinationParsed.Info = destinationInfo
		mockParser.On("Parse", mock.Anything, destinationInfo).Return(destinationParsed, nil)

		// A move carrying content is a delete of the source plus a create at the target.
		var written []byte
		rw.On("Delete", mock.Anything, "old/dash.json", "", "move").Return(nil)
		rw.On("Create", mock.Anything, "new/dash.json", "", mock.Anything, "move").
			Return(nil).
			Run(func(args mock.Arguments) { written = args.Get(3).([]byte) })

		dw := newDualWriter(t, config, rw, mockParser)
		_, err := dw.MoveResource(context.Background(), DualWriteOptions{
			OriginalPath: "old/dash.json",
			Path:         "new/dash.json",
			Data:         newContent,
			Message:      "move",
		})
		require.NoError(t, err, "the move must not be rejected by the secure-value guard")
		require.NotContains(t, string(written), "super-secret")
		require.NotContains(t, string(written), "secure")
	})

	// The parser resolves the folder behind the source delete check from
	// _folder.json, and the Authorizer requires that to come from the configured
	// branch: metadata on a caller-supplied ref can name any folder.
	t.Run("the original is read on the configured branch, not the target ref", func(t *testing.T) {
		config, rw := newSyncedGitRepo(t)
		// Writing to a ref other than the configured branch needs the branch workflow.
		config.Spec.Workflows = append(config.Spec.Workflows, provisioning.BranchWorkflow)
		mockParser := NewMockParser(t)

		originalFile := &repository.FileInfo{Data: []byte(`{}`), Path: "old/dash.json"}
		rw.On("Read", mock.Anything, "old/dash.json", "").Return(originalFile, nil)
		mockParser.On("Parse", mock.Anything, originalFile).
			Return(newParsed(t, map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata":   map[string]any{"name": "dash-uid"},
			}, nil), nil)
		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(nil, assert.AnError).Maybe()

		dw := newDualWriter(t, config, rw, mockParser)
		_, err := dw.MoveResource(context.Background(), DualWriteOptions{
			OriginalPath: "old/dash.json",
			Path:         "new/dash.json",
			Ref:          "feature",
			Data:         []byte(`{}`),
			Message:      "move",
		})
		require.Error(t, err, "the move stops once the source has been parsed")

		rw.AssertNotCalled(t, "Read", mock.Anything, "old/dash.json", "feature")
	})
}

func TestKeepCommittedSecureValues_RepositoryTypeGate(t *testing.T) {
	const path = "datasource.json"

	parsedFor := func(repoType provisioning.RepositoryType) *ParsedResource {
		return &ParsedResource{
			Repo: provisioning.ResourceRepositoryInfo{Type: repoType},
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
				"kind":       "DataSource",
				"metadata":   map[string]any{"name": "ds-1"},
				"spec":       map[string]any{"title": "DS"},
			}},
		}
	}

	t.Run("a git repository is not read at all", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)

		dw := &DualReadWriter{repo: rw}
		parsed := parsedFor(provisioning.GitHubRepositoryType)
		require.NoError(t, dw.keepCommittedSecureValues(context.Background(), parsed, path, ""))
		require.NotContains(t, parsed.Obj.Object, "secure")
		rw.AssertNotCalled(t, "Read", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("a repository that allows secure values is read", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, path, "").Return(&repository.FileInfo{Path: path, Data: []byte(`{
			"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
			"kind": "DataSource",
			"metadata": {"name": "ds-1"},
			"spec": {"title": "DS"},
			"secure": {"password": {"create": "hunter2"}}
		}`)}, nil)

		dw := &DualReadWriter{repo: rw}
		parsed := parsedFor(provisioning.LocalRepositoryType)
		require.NoError(t, dw.keepCommittedSecureValues(context.Background(), parsed, path, ""))
		require.Equal(t,
			map[string]any{"password": map[string]any{"create": "hunter2"}},
			parsed.Obj.Object["secure"])
	})
}

func TestDualReadWriter_FileSizeLimit(t *testing.T) {
	const (
		repoName = "repo"
		path     = "datasource.json"
	)

	committed := &repository.FileInfo{Path: path, Data: []byte(`{
		"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
		"kind": "DataSource",
		"metadata": {"name": "ds-1"},
		"spec": {"title": "DS"},
		"secure": {"password": {"create": "hunter2"}}
	}`)}

	newParsed := func(t *testing.T) *ParsedResource {
		t.Helper()
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
			"kind":       "DataSource",
			"metadata":   map[string]any{"name": "ds-1", "namespace": "default"},
			"spec":       map[string]any{"title": "DS renamed"},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repoName})

		return &ParsedResource{
			Info:   &repository.FileInfo{Path: path},
			Obj:    obj,
			Meta:   meta,
			GVK:    schema.GroupVersionKind{Group: "testdata.datasource.grafana.app", Version: "v0alpha1", Kind: "DataSource"},
			GVR:    schema.GroupVersionResource{Group: "testdata.datasource.grafana.app", Version: "v0alpha1", Resource: "datasources"},
			Repo:   provisioning.ResourceRepositoryInfo{Name: repoName, Namespace: "default", Type: provisioning.LocalRepositoryType},
			Action: provisioning.ResourceActionUpdate,
		}
	}

	t.Run("the limit applies to the bytes written, not the request body", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(newSyncEnabledConfig(repoName)).Maybe()
		rw.On("Read", mock.Anything, path, "").Return(committed, nil)

		parser := NewMockParser(t)
		parser.On("Parse", mock.Anything, mock.Anything).Return(newParsed(t), nil)

		// Small enough that the restored secure value alone cannot fit.
		dw := NewDualReadWriter(rw, parser, NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind), stubAuthorizer{}, false, 32)
		_, err := dw.UpdateResource(context.Background(), DualWriteOptions{
			Path:       path,
			Message:    "msg",
			SkipDryRun: true,
		})
		require.Error(t, err)
		require.True(t, apierrors.IsRequestEntityTooLargeError(err), "expected 413, got %v", err)
		rw.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("a rename without content is not measured against the serialized form", func(t *testing.T) {
		const originalPath = "old/datasource.json"

		// Compact on disk, so the read that produced it was within the limit, but the
		// re-serialized form is well over it.
		compact := &repository.FileInfo{Path: originalPath, Data: []byte(`{"apiVersion":"testdata.datasource.grafana.app/v0alpha1","kind":"DataSource","metadata":{"name":"ds-1"},"spec":{"title":"DS"}}`)}

		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(newSyncEnabledConfig(repoName)).Maybe()
		rw.On("Read", mock.Anything, originalPath, "").Return(compact, nil)
		moved := false
		rw.On("Move", mock.Anything, originalPath, path, "", "msg").Return(nil).
			Run(func(mock.Arguments) { moved = true })

		parser := NewMockParser(t)
		parser.On("Parse", mock.Anything, mock.Anything).Return(newParsed(t), nil)

		// Smaller than the serialized form, so an unscoped check would reject the rename.
		dw := NewDualReadWriter(rw, parser, NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind), stubAuthorizer{}, false, 32)
		_, err := dw.MoveResource(context.Background(), DualWriteOptions{
			OriginalPath: originalPath,
			Path:         path,
			Message:      "msg",
			SkipDryRun:   true,
		})
		require.NoError(t, err, "a byte-preserving rename must not be judged on bytes it never writes")
		require.True(t, moved, "the rename should have moved the file as it stands")
	})

	t.Run("checkFileSize", func(t *testing.T) {
		for _, tt := range []struct {
			name    string
			max     int64
			size    int
			wantErr bool
		}{
			{name: "disabled", max: 0, size: 4096},
			{name: "under the limit", max: 16, size: 15},
			{name: "at the limit", max: 16, size: 16},
			{name: "over the limit", max: 16, size: 17, wantErr: true},
		} {
			t.Run(tt.name, func(t *testing.T) {
				dw := &DualReadWriter{maxFileSize: tt.max}
				err := dw.checkFileSize(make([]byte, tt.size), path)
				if !tt.wantErr {
					require.NoError(t, err)
					return
				}
				require.True(t, apierrors.IsRequestEntityTooLargeError(err), "expected 413, got %v", err)
			})
		}
	})
}
