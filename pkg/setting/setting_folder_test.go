package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/ini.v1"
)

func TestMaxDeptFolderSettings(t *testing.T) {
	t.Run("returns default when ini file is nil", func(t *testing.T) {
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(nil))
	})

	t.Run("returns default when folder section is absent", func(t *testing.T) {
		f := ini.Empty()
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("returns default when key is missing from folder section", func(t *testing.T) {
		f := ini.Empty()
		_, err := f.NewSection("folder")
		assert.NoError(t, err)
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("returns default when value is not a valid integer", func(t *testing.T) {
		f := ini.Empty()
		s, err := f.NewSection("folder")
		assert.NoError(t, err)
		_, err = s.NewKey("max_nested_folder_depth", "notanint")
		assert.NoError(t, err)
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("returns max when value equals max", func(t *testing.T) {
		f := ini.Empty()
		s, err := f.NewSection("folder")
		assert.NoError(t, err)
		_, err = s.NewKey("max_nested_folder_depth", "7")
		assert.NoError(t, err)
		assert.Equal(t, maxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("clamps to max when value exceeds max", func(t *testing.T) {
		f := ini.Empty()
		s, err := f.NewSection("folder")
		assert.NoError(t, err)
		_, err = s.NewKey("max_nested_folder_depth", "100")
		assert.NoError(t, err)
		assert.Equal(t, maxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("returns default when value is below max", func(t *testing.T) {
		f := ini.Empty()
		s, err := f.NewSection("folder")
		assert.NoError(t, err)
		_, err = s.NewKey("max_nested_folder_depth", "3")
		assert.NoError(t, err)
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("returns default when value is zero", func(t *testing.T) {
		f := ini.Empty()
		s, err := f.NewSection("folder")
		assert.NoError(t, err)
		_, err = s.NewKey("max_nested_folder_depth", "0")
		assert.NoError(t, err)
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(f))
	})

	t.Run("returns default when value is negative", func(t *testing.T) {
		f := ini.Empty()
		s, err := f.NewSection("folder")
		assert.NoError(t, err)
		_, err = s.NewKey("max_nested_folder_depth", "-1")
		assert.NoError(t, err)
		assert.Equal(t, defaultMaxNestedFolderDepth, maxDeptFolderSettings(f))
	})
}
