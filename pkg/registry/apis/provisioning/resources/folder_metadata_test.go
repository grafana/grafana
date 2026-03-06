package resources

import (
	"context"
	"encoding/json"
	"errors"
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

		rw.On("Write", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
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

	t.Run("returns error when repo.Write fails", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		manifest := NewFolderManifest("some-uid", "myfolder")
		rw.On("Write", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").
			Return(assert.AnError)

		_, err := WriteFolderMetadata(context.Background(), rw, "myfolder/", manifest, "", "")

		require.Error(t, err)
	})
}
