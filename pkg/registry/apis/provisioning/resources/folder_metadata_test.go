package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIsFolderMetadataFile(t *testing.T) {
	assert.True(t, IsFolderMetadataFile("_folder.json"))
	assert.True(t, IsFolderMetadataFile("myfolder/_folder.json"))
	assert.True(t, IsFolderMetadataFile("a/b/c/_folder.json"))
	assert.False(t, IsFolderMetadataFile("myfolder/dashboard.json"))
	assert.False(t, IsFolderMetadataFile("myfolder/"))
}

func TestReadFolderMetadata(t *testing.T) {
	const stableUID = "stable-uid-from-folder-json"

	manifest := NewFolderManifest(stableUID, "my-folder", FolderKind)
	validData, err := json.Marshal(manifest)
	require.NoError(t, err)

	t.Run("valid _folder.json returns Folder with correct UID and hash", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: validData, Hash: "abc123"}, nil)

		result, hash, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, stableUID, result.Name)
		assert.Equal(t, "abc123", hash)
	})

	t.Run("read error returns error", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, errors.New("file not found"))

		_, _, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.Error(t, err)
	})

	t.Run("invalid JSON returns error", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("not-json")}, nil)

		_, _, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.Error(t, err)
		require.ErrorIs(t, err, ErrInvalidFolderMetadata)
	})

	t.Run("missing metadata.name returns invalid folder metadata error", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"My Folder"}}`)}, nil)

		_, _, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.Error(t, err)
		require.ErrorIs(t, err, ErrInvalidFolderMetadata)
	})
}

func TestParseFolderWithMetadata_MetadataHash(t *testing.T) {
	const stableUID = "stable-uid"
	manifest := NewFolderManifest(stableUID, "My Folder", FolderKind)
	validData, err := json.Marshal(manifest)
	require.NoError(t, err)

	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "repo-a", Namespace: "default"},
		Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder}},
	}

	t.Run("populates MetadataHash when metadata exists", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(cfg)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: validData, Hash: "metadata-hash-123"}, nil)

		f, err := ParseFolderWithMetadata(context.Background(), rw, "my-folder/", "", true)
		require.NoError(t, err)
		assert.Equal(t, stableUID, f.ID)
		assert.Equal(t, "My Folder", f.Title)
		assert.Equal(t, "metadata-hash-123", f.MetadataHash)
	})

	t.Run("MetadataHash is empty when metadata disabled", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(cfg)

		f, err := ParseFolderWithMetadata(context.Background(), rw, "my-folder/", "", false)
		require.NoError(t, err)
		assert.Empty(t, f.MetadataHash)
	})

	t.Run("MetadataHash is empty when _folder.json missing", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(cfg)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		f, err := ParseFolderWithMetadata(context.Background(), rw, "my-folder/", "", true)
		require.NoError(t, err)
		assert.Empty(t, f.MetadataHash)
	})
}

func TestWriteFolderMetadata(t *testing.T) {
	t.Run("writes _folder.json and returns stable UID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)

		const uid = "my-stable-uid"
		manifest := NewFolderManifest(uid, "myfolder", FolderKind)

		rw.On("Create", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			return f.APIVersion == "folder.grafana.app/v1beta1" &&
				f.Kind == "Folder" &&
				f.Name == uid &&
				f.Spec.Title == "myfolder"
		}), "").Return(nil)

		returnedUID, err := WriteFolderMetadata(context.Background(), rw, "myfolder/", manifest, "", "")

		require.NoError(t, err)
		assert.Equal(t, uid, returnedUID)
	})

	t.Run("returns error when repo.Create fails", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		manifest := NewFolderManifest("some-uid", "myfolder", FolderKind)
		rw.On("Create", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").
			Return(assert.AnError)

		_, err := WriteFolderMetadata(context.Background(), rw, "myfolder/", manifest, "", "")

		require.Error(t, err)
	})
}

func TestMissingFolderMetadata_SentinelError(t *testing.T) {
	t.Run("errors.Is matches ErrMissingFolderMetadata", func(t *testing.T) {
		err := &MissingFolderMetadata{Path: "x/"}
		assert.True(t, errors.Is(err, ErrMissingFolderMetadata))
	})

	t.Run("errors.Is does not match unrelated error", func(t *testing.T) {
		assert.False(t, errors.Is(errors.New("other"), ErrMissingFolderMetadata))
	})

	t.Run("errors.As extracts MissingFolderMetadata from wrapped error", func(t *testing.T) {
		original := &MissingFolderMetadata{Path: "x/"}
		wrapped := fmt.Errorf("wrap: %w", original)

		var target *MissingFolderMetadata
		require.True(t, errors.As(wrapped, &target))
		assert.Equal(t, "x/", target.Path)
	})

	t.Run("errors.Is matches through fmt.Errorf wrapping", func(t *testing.T) {
		wrapped := fmt.Errorf("wrap: %w", &MissingFolderMetadata{Path: "y/"})
		assert.True(t, errors.Is(wrapped, ErrMissingFolderMetadata))
	})
}

func TestNewMissingFolderMetadata(t *testing.T) {
	err := NewMissingFolderMetadata("team-a/dashboards/")
	require.NotNil(t, err)
	assert.Equal(t, "team-a/dashboards/", err.Path)
}

func TestMissingFolderMetadata_Error(t *testing.T) {
	err := &MissingFolderMetadata{Path: "team-a/dashboards/"}
	assert.Contains(t, err.Error(), "team-a/dashboards/")
	assert.Contains(t, err.Error(), "missing folder metadata file")
}

func TestFolderMetadataConflict_SentinelError(t *testing.T) {
	t.Run("errors.Is matches ErrFolderMetadataConflict", func(t *testing.T) {
		err := &FolderMetadataConflict{Path: "x/", Reason: "uid mismatch"}
		assert.True(t, errors.Is(err, ErrFolderMetadataConflict))
	})

	t.Run("errors.Is does not match unrelated error", func(t *testing.T) {
		assert.False(t, errors.Is(errors.New("other"), ErrFolderMetadataConflict))
	})

	t.Run("errors.Is does not match ErrMissingFolderMetadata", func(t *testing.T) {
		err := &FolderMetadataConflict{Path: "x/", Reason: "uid mismatch"}
		assert.False(t, errors.Is(err, ErrMissingFolderMetadata))
	})

	t.Run("errors.As extracts FolderMetadataConflict from wrapped error", func(t *testing.T) {
		original := &FolderMetadataConflict{Path: "x/", Reason: "uid mismatch"}
		wrapped := fmt.Errorf("wrap: %w", original)

		var target *FolderMetadataConflict
		require.True(t, errors.As(wrapped, &target))
		assert.Equal(t, "x/", target.Path)
		assert.Equal(t, "uid mismatch", target.Reason)
	})

	t.Run("errors.Is matches through fmt.Errorf wrapping", func(t *testing.T) {
		wrapped := fmt.Errorf("wrap: %w", &FolderMetadataConflict{Path: "y/", Reason: "deleted"})
		assert.True(t, errors.Is(wrapped, ErrFolderMetadataConflict))
	})
}

func TestInvalidFolderMetadata_SentinelError(t *testing.T) {
	t.Run("errors.Is matches ErrInvalidFolderMetadata", func(t *testing.T) {
		err := &InvalidFolderMetadata{Path: "x/", Err: errors.New("missing metadata.name")}
		assert.True(t, errors.Is(err, ErrInvalidFolderMetadata))
	})

	t.Run("errors.Is does not match unrelated error", func(t *testing.T) {
		assert.False(t, errors.Is(errors.New("other"), ErrInvalidFolderMetadata))
	})

	t.Run("errors.As extracts InvalidFolderMetadata from wrapped error", func(t *testing.T) {
		original := &InvalidFolderMetadata{Path: "x/", Err: errors.New("bad manifest")}
		wrapped := fmt.Errorf("wrap: %w", original)

		var target *InvalidFolderMetadata
		require.True(t, errors.As(wrapped, &target))
		assert.Equal(t, "x/", target.Path)
		assert.EqualError(t, target.Err, "bad manifest")
	})
}

func TestNewInvalidFolderMetadata(t *testing.T) {
	err := NewInvalidFolderMetadata("team-a/dashboards/", errors.New("missing metadata.name"))
	require.NotNil(t, err)
	assert.Equal(t, "team-a/dashboards/", err.Path)
	assert.Empty(t, err.Action)
	assert.EqualError(t, err.Err, "missing metadata.name")
}

func TestInvalidFolderMetadata_Error(t *testing.T) {
	err := &InvalidFolderMetadata{Path: "team-a/dashboards/", Err: errors.New("missing metadata.name")}
	assert.Contains(t, err.Error(), "team-a/dashboards/")
	assert.Contains(t, err.Error(), "invalid folder metadata")
	assert.Contains(t, err.Error(), "missing metadata.name")
}

func TestInvalidFolderMetadata_WithAction(t *testing.T) {
	err := NewInvalidFolderMetadata("team-a/dashboards/", errors.New("missing metadata.name"))

	got := err.WithAction(repository.FileActionCreated)

	require.Same(t, err, got)
	assert.Equal(t, "team-a/dashboards/", err.Path)
	assert.Equal(t, repository.FileActionCreated, err.Action)
	assert.EqualError(t, err.Err, "missing metadata.name")
}

func TestFolderMetadataConflict_Error(t *testing.T) {
	err := &FolderMetadataConflict{Path: "team-a/dashboards/", Reason: "user deleted folder"}
	assert.Contains(t, err.Error(), "team-a/dashboards/")
	assert.Contains(t, err.Error(), "user deleted folder")
	assert.Contains(t, err.Error(), "folder metadata conflict")
}

func TestNewFolderManifest(t *testing.T) {
	f := NewFolderManifest("my-uid", "My Folder", FolderKind)
	require.NotNil(t, f)
	assert.Equal(t, "my-uid", f.Name)
	assert.Equal(t, "My Folder", f.Spec.Title)

	gvk := f.GetObjectKind().GroupVersionKind()
	assert.Equal(t, "folder.grafana.app", gvk.Group)
	assert.Equal(t, "v1beta1", gvk.Version)
	assert.Equal(t, "Folder", gvk.Kind)
}

func TestFindFoldersMissingMetadata(t *testing.T) {
	tests := []struct {
		name     string
		source   []repository.FileTreeEntry
		expected []string
	}{
		{
			name:     "empty tree",
			source:   nil,
			expected: nil,
		},
		{
			name: "no directories",
			source: []repository.FileTreeEntry{
				{Path: "dashboard.json", Blob: true},
			},
			expected: nil,
		},
		{
			name: "directory with _folder.json",
			source: []repository.FileTreeEntry{
				{Path: "myfolder", Blob: false},
				{Path: "myfolder/_folder.json", Blob: true},
				{Path: "myfolder/dashboard.json", Blob: true},
			},
			expected: nil,
		},
		{
			name: "directory missing _folder.json",
			source: []repository.FileTreeEntry{
				{Path: "myfolder", Blob: false},
				{Path: "myfolder/dashboard.json", Blob: true},
			},
			expected: []string{"myfolder/"},
		},
		{
			name: "mixed: some with and some without _folder.json",
			source: []repository.FileTreeEntry{
				{Path: "withMeta", Blob: false},
				{Path: "withMeta/_folder.json", Blob: true},
				{Path: "withMeta/dashboard.json", Blob: true},
				{Path: "noMeta", Blob: false},
				{Path: "noMeta/dashboard.json", Blob: true},
			},
			expected: []string{"noMeta/"},
		},
		{
			name: "directory path already has trailing slash",
			source: []repository.FileTreeEntry{
				{Path: "myfolder/", Blob: false},
				{Path: "myfolder/dashboard.json", Blob: true},
			},
			expected: []string{"myfolder/"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FindFoldersMissingMetadata(tt.source)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseFolderResource(t *testing.T) {
	ctx := context.Background()
	testPath := "team-a/project-x/"
	testRef := "main"

	// Create a test repo config
	testRepoConfig := newTestRepoConfig("test-repo")

	// Create test folder metadata
	testFolder := NewFolderManifest("stable-uid-123", "project-x", FolderKind)
	metadataBytes, err := json.Marshal(testFolder)
	require.NoError(t, err)

	tests := []struct {
		name                  string
		path                  string
		folderMetadataEnabled bool
		setupMock             func(*repository.MockReader)
		expectedFolderID      string
		expectedAction        string
		expectedTitle         string
		expectedParentFolder  string
		expectedErr           bool
		description           string
	}{
		{
			name:                  "metadata enabled and exists - returns stable UID with Update action",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(&repository.FileInfo{
						Data: metadataBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
				// Parent folder metadata read
				parentFolder := NewFolderManifest("parent-uid-456", "team-a", FolderKind)
				parentBytes, _ := json.Marshal(parentFolder)
				reader.On("Read", mock.Anything, "team-a/_folder.json", testRef).
					Return(&repository.FileInfo{Data: parentBytes}, nil)
			},
			expectedFolderID:     "stable-uid-123",
			expectedAction:       "update",
			expectedTitle:        "project-x",
			expectedParentFolder: "parent-uid-456",
			expectedErr:          false,
			description:          "When metadata exists, use stable UID and set Action to Update",
		},
		{
			name:                  "metadata enabled but not found, folder exists - returns hash-based ID with Update",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				// Config calls (may be called multiple times)
				reader.On("Config").Return(testRepoConfig).Maybe()
				// Folder metadata read (not found)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(nil, repository.ErrFileNotFound).Once()
				// Folder exists check
				reader.On("Read", mock.Anything, testPath, testRef).
					Return(&repository.FileInfo{Path: testPath}, nil).Once()
				// Parent folder metadata read (not found) - GetFolderID only reads metadata, not existence
				reader.On("Read", mock.Anything, "team-a/_folder.json", testRef).
					Return(nil, repository.ErrFileNotFound).Once()
			},
			expectedFolderID:     ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedAction:       "update",
			expectedTitle:        "project-x",
			expectedParentFolder: ParseFolder("team-a/", testRepoConfig.Name).ID,
			expectedErr:          false,
			description:          "When metadata not found but folder exists, use hash-based ID with Update",
		},
		{
			name:                  "metadata enabled but not found, folder doesn't exist - returns hash-based ID with Create",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				// Config calls (may be called multiple times)
				reader.On("Config").Return(testRepoConfig).Maybe()
				// Folder metadata read (not found)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(nil, repository.ErrFileNotFound).Once()
				// Folder doesn't exist check
				reader.On("Read", mock.Anything, testPath, testRef).
					Return(nil, repository.ErrFileNotFound).Once()
				// Parent folder metadata read (not found) - GetFolderID only reads metadata, not existence
				reader.On("Read", mock.Anything, "team-a/_folder.json", testRef).
					Return(nil, repository.ErrFileNotFound).Once()
			},
			expectedFolderID:     ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedAction:       "create",
			expectedTitle:        "project-x",
			expectedParentFolder: ParseFolder("team-a/", testRepoConfig.Name).ID,
			expectedErr:          false,
			description:          "When metadata and folder not found, use hash-based ID with Create",
		},
		{
			name:                  "metadata disabled, folder exists - returns hash-based ID with Update",
			path:                  testPath,
			folderMetadataEnabled: false,
			setupMock: func(reader *repository.MockReader) {
				// Config calls (may be called multiple times)
				reader.On("Config").Return(testRepoConfig).Maybe()
				// Folder exists check
				reader.On("Read", mock.Anything, testPath, testRef).
					Return(&repository.FileInfo{Path: testPath}, nil).Once()
			},
			expectedFolderID:     ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedAction:       "update",
			expectedTitle:        "project-x",
			expectedParentFolder: ParseFolder("team-a/", testRepoConfig.Name).ID,
			expectedErr:          false,
			description:          "When metadata disabled and folder exists, use hash-based ID with Update",
		},
		{
			name:                  "metadata disabled, folder doesn't exist - returns hash-based ID with Create",
			path:                  testPath,
			folderMetadataEnabled: false,
			setupMock: func(reader *repository.MockReader) {
				// Config calls (may be called multiple times)
				reader.On("Config").Return(testRepoConfig).Maybe()
				// Folder doesn't exist check
				reader.On("Read", mock.Anything, testPath, testRef).
					Return(nil, repository.ErrFileNotFound).Once()
			},
			expectedFolderID:     ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedAction:       "create",
			expectedTitle:        "project-x",
			expectedParentFolder: ParseFolder("team-a/", testRepoConfig.Name).ID,
			expectedErr:          false,
			description:          "When metadata disabled and folder doesn't exist, use hash-based ID with Create",
		},
		{
			name:                  "metadata read error (not NotFound) - returns error",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(nil, fmt.Errorf("permission denied"))
			},
			expectedErr: true,
			description: "When metadata read fails with non-NotFound error, propagate error",
		},
		{
			name:                  "folder existence check error (not NotFound) - returns error",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(nil, repository.ErrFileNotFound)
				// Folder existence check fails with real error
				reader.On("Read", mock.Anything, testPath, testRef).
					Return(nil, fmt.Errorf("permission denied"))
			},
			expectedErr: true,
			description: "When folder existence check fails with non-NotFound error, propagate error",
		},
		{
			name:                  "root-level folder with metadata - no parent folder",
			path:                  "root-folder/",
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				rootFolder := NewFolderManifest("root-uid-789", "root-folder", FolderKind)
				rootBytes, _ := json.Marshal(rootFolder)
				reader.On("Read", mock.Anything, "root-folder/_folder.json", testRef).
					Return(&repository.FileInfo{Data: rootBytes}, nil)
			},
			expectedFolderID:     "root-uid-789",
			expectedAction:       "update",
			expectedTitle:        "root-folder",
			expectedParentFolder: "", // Root has no parent
			expectedErr:          false,
			description:          "Root-level folder has empty parent folder ID",
		},
		{
			name:                  "metadata enabled with custom title - preserves metadata title instead of path",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				customFolder := NewFolderManifest("stable-uid-123", "My Custom Project Title", FolderKind)
				customBytes, _ := json.Marshal(customFolder)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(&repository.FileInfo{
						Data: customBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
				parentFolder := NewFolderManifest("parent-uid-456", "team-a", FolderKind)
				parentBytes, _ := json.Marshal(parentFolder)
				reader.On("Read", mock.Anything, "team-a/_folder.json", testRef).
					Return(&repository.FileInfo{Data: parentBytes}, nil)
			},
			expectedFolderID:     "stable-uid-123",
			expectedAction:       "update",
			expectedTitle:        "My Custom Project Title",
			expectedParentFolder: "parent-uid-456",
			expectedErr:          false,
			description:          "When metadata exists with custom title, preserve it instead of using path-based title",
		},
		{
			name:                  "metadata enabled with empty title - falls back to path-based title",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				emptyTitleFolder := NewFolderManifest("stable-uid-123", "", FolderKind)
				emptyBytes, _ := json.Marshal(emptyTitleFolder)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(&repository.FileInfo{
						Data: emptyBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
				parentFolder := NewFolderManifest("parent-uid-456", "team-a", FolderKind)
				parentBytes, _ := json.Marshal(parentFolder)
				reader.On("Read", mock.Anything, "team-a/_folder.json", testRef).
					Return(&repository.FileInfo{Data: parentBytes}, nil)
			},
			expectedFolderID:     "stable-uid-123",
			expectedAction:       "update",
			expectedTitle:        "project-x",
			expectedParentFolder: "parent-uid-456",
			expectedErr:          false,
			description:          "When metadata exists but title is empty, fall back to path-based title",
		},
		{
			name:                  "parent folder ID error propagates",
			path:                  testPath,
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(&repository.FileInfo{Data: metadataBytes}, nil)
				// Parent folder metadata read fails
				reader.On("Read", mock.Anything, "team-a/_folder.json", testRef).
					Return(nil, fmt.Errorf("permission denied"))
			},
			expectedErr: true,
			description: "When parent folder ID resolution fails, propagate error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := repository.NewMockReader(t)
			tt.setupMock(reader)

			result, err := ParseFolderResource(ctx, reader, tt.path, testRef, tt.folderMetadataEnabled, FolderKind)

			if tt.expectedErr {
				assert.Error(t, err, tt.description)
				return
			}

			require.NoError(t, err, tt.description)
			require.NotNil(t, result)

			// Verify folder ID
			assert.Equal(t, tt.expectedFolderID, result.Meta.GetName(), "folder ID should match")

			// Verify action
			assert.Equal(t, tt.expectedAction, string(result.Action), "action should match")

			// Verify title from folder object
			assert.Equal(t, tt.expectedTitle, result.Obj.Object["spec"].(map[string]interface{})["title"], "title should be derived from path")

			// Verify parent folder context
			assert.Equal(t, tt.expectedParentFolder, result.Meta.GetFolder(), "parent folder ID should match")

			// Verify GVK and GVR
			assert.Equal(t, "folder.grafana.app", result.GVK.Group)
			assert.Equal(t, "v1beta1", result.GVK.Version)
			assert.Equal(t, "Folder", result.GVK.Kind)
		})
	}
}

func TestWriteFolderMetadataUpdate(t *testing.T) {
	ctx := context.Background()

	const existingUID = "existing-uid-123"
	existingManifest := NewFolderManifest(existingUID, "Original Title", FolderKind)
	existingData, err := json.Marshal(existingManifest)
	require.NoError(t, err)

	t.Run("updates title when ID matches", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			return f.Name == existingUID && f.Spec.Title == "New Title"
		}), "").Return(nil)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-hash"}, nil).Once()

		submitted := NewFolderManifest(existingUID, "New Title", FolderKind)
		hash, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.NoError(t, err)
		assert.Equal(t, "new-hash", hash)
	})

	t.Run("updates title when submitted ID is empty", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			return f.Name == existingUID && f.Spec.Title == "Title With No ID"
		}), "").Return(nil)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-hash"}, nil).Once()

		submitted := &folders.Folder{}
		submitted.Spec.Title = "Title With No ID"
		hash, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.NoError(t, err)
		assert.Equal(t, "new-hash", hash)
	})

	t.Run("rejects ID change", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil)

		submitted := NewFolderManifest("different-uid", "Some Title", FolderKind)
		_, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "folder ID change is not allowed")
	})

	t.Run("rejects empty title", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil)

		submitted := NewFolderManifest(existingUID, "", FolderKind)
		_, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "title must not be empty")
	})

	t.Run("returns error when existing _folder.json not found", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		submitted := NewFolderManifest("any-uid", "Title", FolderKind)
		_, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.Error(t, err)
	})

	t.Run("returns error when repo Update fails", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").
			Return(assert.AnError)

		submitted := NewFolderManifest(existingUID, "New Title", FolderKind)
		_, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.Error(t, err)
	})

	t.Run("updates description when provided", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			return f.Name == existingUID &&
				f.Spec.Title == "New Title" &&
				f.Spec.Description != nil &&
				*f.Spec.Description == "New Description"
		}), "").Return(nil)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("{}"), Hash: "desc-hash"}, nil).Once()

		submitted := NewFolderManifest(existingUID, "New Title", FolderKind)
		desc := "New Description"
		submitted.Spec.Description = &desc
		hash, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.NoError(t, err)
		assert.Equal(t, "desc-hash", hash)
	})

	t.Run("preserves existing description when not provided in submission", func(t *testing.T) {
		existingWithDesc := NewFolderManifest(existingUID, "Original Title", FolderKind)
		origDesc := "Existing Description"
		existingWithDesc.Spec.Description = &origDesc
		existingWithDescData, err := json.Marshal(existingWithDesc)
		require.NoError(t, err)

		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingWithDescData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			return f.Spec.Title == "New Title" &&
				f.Spec.Description != nil &&
				*f.Spec.Description == "Existing Description"
		}), "").Return(nil)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-hash"}, nil).Once()

		submitted := &folders.Folder{}
		submitted.Spec.Title = "New Title"
		hash, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.NoError(t, err)
		assert.Equal(t, "new-hash", hash)
	})

	t.Run("returns error when re-read after update fails", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").Return(nil)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(nil, fmt.Errorf("storage error")).Once()

		submitted := NewFolderManifest(existingUID, "New Title", FolderKind)
		_, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "", "", submitted)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "re-read updated folder metadata")
	})

	t.Run("passes ref and message to repo operations", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "feature-branch").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "feature-branch", mock.Anything, "my commit message").Return(nil)
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "feature-branch").
			Return(&repository.FileInfo{Data: []byte("{}"), Hash: "branch-hash"}, nil).Once()

		submitted := NewFolderManifest(existingUID, "New Title", FolderKind)
		hash, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "feature-branch", "my commit message", submitted)

		require.NoError(t, err)
		assert.Equal(t, "branch-hash", hash)
		rw.AssertExpectations(t)
	})

	t.Run("falls back to configured branch when ref not found", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		// First read with new-branch ref returns ErrRefNotFound
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "new-branch").
			Return(nil, repository.ErrRefNotFound).Once()
		// Fallback read with empty ref (configured branch) returns existing data
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(&repository.FileInfo{Data: existingData, Hash: "old-hash"}, nil).Once()
		// Update writes to the new branch (ensureBranchExists creates it)
		rw.On("Update", mock.Anything, "myfolder/_folder.json", "new-branch", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			return f.Name == existingUID && f.Spec.Title == "New Title"
		}), "rename folder").Return(nil)
		// Re-read after update to get new hash
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "new-branch").
			Return(&repository.FileInfo{Data: []byte("{}"), Hash: "new-branch-hash"}, nil).Once()

		submitted := NewFolderManifest(existingUID, "New Title", FolderKind)
		hash, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "new-branch", "rename folder", submitted)

		require.NoError(t, err)
		assert.Equal(t, "new-branch-hash", hash)
		rw.AssertExpectations(t)
	})

	t.Run("returns error when both ref and configured branch fail", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		// First read with new-branch ref returns ErrRefNotFound
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "new-branch").
			Return(nil, repository.ErrRefNotFound).Once()
		// Fallback read with empty ref also fails
		rw.On("Read", mock.Anything, "myfolder/_folder.json", "").
			Return(nil, repository.ErrFileNotFound).Once()

		submitted := NewFolderManifest("any-uid", "Title", FolderKind)
		_, err := WriteFolderMetadataUpdate(ctx, rw, "myfolder/", "new-branch", "", submitted)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "read existing folder metadata")
	})
}

func TestGetFolderID(t *testing.T) {
	ctx := context.Background()
	testPath := "team-a/project-x/"
	testRef := ""

	// Create a test repo config
	testRepoConfig := newTestRepoConfig("test-repo")

	// Create test folder metadata
	testFolder := NewFolderManifest("stable-uid-123", "Test Folder", FolderKind)
	metadataBytes, err := json.Marshal(testFolder)
	require.NoError(t, err)

	tests := []struct {
		name                  string
		folderMetadataEnabled bool
		setupMock             func(*repository.MockReader)
		expectedID            string
		expectedErr           bool
		description           string
	}{
		{
			name:                  "metadata enabled and exists - returns stable UID",
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", "").
					Return(&repository.FileInfo{
						Data: metadataBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
			},
			expectedID:  "stable-uid-123",
			expectedErr: false,
			description: "When metadata is enabled and _folder.json exists with a valid UID, return the stable UID",
		},
		{
			name:                  "metadata enabled but file not found - returns hash-based ID",
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", "").
					Return(nil, repository.ErrFileNotFound)
			},
			expectedID:  ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedErr: false,
			description: "When metadata is enabled but _folder.json doesn't exist, fall back to hash-based ID",
		},
		{
			name:                  "metadata enabled but read fails - returns error",
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", "").
					Return(nil, fmt.Errorf("permission denied"))
			},
			expectedID:  "",
			expectedErr: true,
			description: "When metadata read fails with non-NotFound error, propagate the error",
		},
		{
			name:                  "metadata enabled but empty UID - returns invalid folder metadata error",
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				emptyFolder := NewFolderManifest("", "Empty UID Folder", FolderKind)
				emptyBytes, _ := json.Marshal(emptyFolder)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", "").
					Return(&repository.FileInfo{
						Data: emptyBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
			},
			expectedID:  "",
			expectedErr: true,
			description: "When metadata exists but UID is empty, return invalid folder metadata error",
		},
		{
			name:                  "metadata disabled - returns hash-based ID",
			folderMetadataEnabled: false,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				// Should not call Read when metadata is disabled
			},
			expectedID:  ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedErr: false,
			description: "When metadata is disabled, return hash-based ID without attempting to read metadata",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := repository.NewMockReader(t)
			tt.setupMock(reader)

			result, err := GetFolderID(ctx, reader, testPath, testRef, tt.folderMetadataEnabled)

			if tt.expectedErr {
				assert.Error(t, err, tt.description)
			} else {
				assert.NoError(t, err, tt.description)
				assert.Equal(t, tt.expectedID, result, tt.description)
			}
		})
	}
}
