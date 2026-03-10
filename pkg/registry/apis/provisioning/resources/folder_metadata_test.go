package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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
				reader.On("Read", mock.Anything, "team-a/project-x/_folder.json", "").
					Return(&repository.FileInfo{
						Data: metadataBytes,
						Path: "team-a/project-x/_folder.json",
					}, nil)
				// Config() should not be called when metadata is found
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
