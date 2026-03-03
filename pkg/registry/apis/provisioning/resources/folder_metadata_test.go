package resources

import (
	"context"
	"encoding/json"
	"testing"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestMarshalFolderManifest(t *testing.T) {
	uid, data, err := MarshalFolderManifest("my-folder/")

	require.NoError(t, err)
	assert.NotEmpty(t, uid)
	assert.NotEmpty(t, data)

	var f folders.Folder
	require.NoError(t, json.Unmarshal(data, &f))
	assert.Equal(t, "folder.grafana.app/v1beta1", f.APIVersion)
	assert.Equal(t, "Folder", f.Kind)
	assert.Equal(t, uid, f.Name)
	assert.Equal(t, "my-folder", f.Spec.Title)
}

func TestMarshalFolderManifest_NestedPath(t *testing.T) {
	uid, data, err := MarshalFolderManifest("parent/child-folder/")

	require.NoError(t, err)
	assert.NotEmpty(t, uid)

	var f folders.Folder
	require.NoError(t, json.Unmarshal(data, &f))
	// Title should be derived from the last path segment only
	assert.Equal(t, "child-folder", f.Spec.Title)
	assert.Equal(t, uid, f.Name)
}

func TestFolderManifestUID_RoundTrip(t *testing.T) {
	uid, data, err := MarshalFolderManifest("some-path/")
	require.NoError(t, err)

	got, err := FolderManifestUID(data)
	require.NoError(t, err)
	assert.Equal(t, uid, got)
}

func TestFolderManifestUID_InvalidJSON(t *testing.T) {
	_, err := FolderManifestUID([]byte("not-json"))
	assert.Error(t, err)
}

func TestWriteFolderMetadata(t *testing.T) {
	t.Run("writes _folder.json and returns stable UID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)

		var capturedUID string
		rw.On("Create", mock.Anything, "myfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
			var f folders.Folder
			if err := json.Unmarshal(b, &f); err != nil {
				return false
			}
			capturedUID = f.Name
			return f.APIVersion == "folder.grafana.app/v1beta1" &&
				f.Kind == "Folder" &&
				f.Name != "" &&
				f.Spec.Title == "myfolder"
		}), "").Return(nil)

		uid, err := WriteFolderMetadata(context.Background(), rw, "myfolder/", "", "")

		require.NoError(t, err)
		assert.NotEmpty(t, uid)
		assert.Equal(t, capturedUID, uid, "returned UID must match the one written to _folder.json")
	})

	t.Run("returns error when repo.Create fails", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Create", mock.Anything, "myfolder/_folder.json", "", mock.Anything, "").
			Return(assert.AnError)

		_, err := WriteFolderMetadata(context.Background(), rw, "myfolder/", "", "")

		require.Error(t, err)
	})
}
