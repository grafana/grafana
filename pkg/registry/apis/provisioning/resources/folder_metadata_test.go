package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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

	manifest := NewFolderManifest(stableUID, "my-folder")
	validData, err := json.Marshal(manifest)
	require.NoError(t, err)

	t.Run("valid _folder.json returns Folder with correct UID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: validData}, nil)

		result, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, stableUID, result.Name)
	})

	t.Run("read error returns error", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, errors.New("file not found"))

		_, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.Error(t, err)
	})

	t.Run("invalid JSON returns error", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("not-json")}, nil)

		_, err := ReadFolderMetadata(context.Background(), rw, "my-folder/", "")

		require.Error(t, err)
	})
}

func TestWriteFolderMetadata(t *testing.T) {
	t.Run("writes _folder.json and returns stable UID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)

		const uid = "my-stable-uid"
		manifest := NewFolderManifest(uid, "myfolder")

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
		manifest := NewFolderManifest("some-uid", "myfolder")
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

func TestFolderMetadataConflict_Error(t *testing.T) {
	err := &FolderMetadataConflict{Path: "team-a/dashboards/", Reason: "user deleted folder"}
	assert.Contains(t, err.Error(), "team-a/dashboards/")
	assert.Contains(t, err.Error(), "user deleted folder")
	assert.Contains(t, err.Error(), "folder metadata conflict")
}

func TestNewFolderManifest(t *testing.T) {
	f := NewFolderManifest("my-uid", "My Folder")
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
	testFolder := NewFolderManifest("stable-uid-123", "project-x")
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
				parentFolder := NewFolderManifest("parent-uid-456", "team-a")
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
				rootFolder := NewFolderManifest("root-uid-789", "root-folder")
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
				customFolder := NewFolderManifest("stable-uid-123", "My Custom Project Title")
				customBytes, _ := json.Marshal(customFolder)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(&repository.FileInfo{
						Data: customBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
				parentFolder := NewFolderManifest("parent-uid-456", "team-a")
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
				emptyTitleFolder := NewFolderManifest("stable-uid-123", "")
				emptyBytes, _ := json.Marshal(emptyTitleFolder)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", testRef).
					Return(&repository.FileInfo{
						Data: emptyBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
				parentFolder := NewFolderManifest("parent-uid-456", "team-a")
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

			result, err := ParseFolderResource(ctx, reader, tt.path, testRef, tt.folderMetadataEnabled)

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

func TestGetFolderID(t *testing.T) {
	ctx := context.Background()
	testPath := "team-a/project-x/"
	testRef := ""

	// Create a test repo config
	testRepoConfig := newTestRepoConfig("test-repo")

	// Create test folder metadata
	testFolder := NewFolderManifest("stable-uid-123", "Test Folder")
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
			name:                  "metadata enabled but empty UID - returns hash-based ID",
			folderMetadataEnabled: true,
			setupMock: func(reader *repository.MockReader) {
				reader.On("Config").Return(testRepoConfig)
				emptyFolder := NewFolderManifest("", "Empty UID Folder")
				emptyBytes, _ := json.Marshal(emptyFolder)
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", "").
					Return(&repository.FileInfo{
						Data: emptyBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
			},
			expectedID:  ParseFolder(testPath, testRepoConfig.Name).ID,
			expectedErr: false,
			description: "When metadata exists but UID is empty, fall back to hash-based ID",
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
