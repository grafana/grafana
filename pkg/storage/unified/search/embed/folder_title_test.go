package embed

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFolderUIDFromValue(t *testing.T) {
	t.Run("annotation present", func(t *testing.T) {
		value := []byte(`{"metadata":{"annotations":{"grafana.app/folder":"folder-uid"}}}`)
		assert.Equal(t, "folder-uid", FolderUIDFromValue(value))
	})

	t.Run("annotation absent", func(t *testing.T) {
		value := []byte(`{"metadata":{"annotations":{}}}`)
		assert.Empty(t, FolderUIDFromValue(value))
	})

	t.Run("no metadata", func(t *testing.T) {
		assert.Empty(t, FolderUIDFromValue([]byte(`{"spec":{"title":"x"}}`)))
	})

	t.Run("malformed JSON", func(t *testing.T) {
		assert.Empty(t, FolderUIDFromValue([]byte(`{not json`)))
	})

	t.Run("empty value", func(t *testing.T) {
		assert.Empty(t, FolderUIDFromValue(nil))
	})
}
