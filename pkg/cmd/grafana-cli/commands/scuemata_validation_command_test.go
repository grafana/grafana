package commands

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//go:embed testdata/public/*/*.cue testdata/public/*/plugin.json
var base embed.FS
var pluginSchema, _ = fs.Sub(base, "testdata/public")

func TestValidateScuemataBasics(t *testing.T) {
	t.Run("Testing scuemata validity with valid cue schemas", func(t *testing.T) {
		tempDir := os.DirFS(filepath.Join("testdata", "valid_scuemata"))

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       tempDir,
			DistPluginCueFS: pluginSchema,
		}

		err := validate(nil, baseLoadPaths, load.BaseDashboardFamily)
		require.NoError(t, err, "error while loading base dashboard scuemata")

		err = validate(nil, baseLoadPaths, load.DistDashboardFamily)
		require.NoError(t, err, "error while loading dist dashboard scuemata")
	})

	t.Run("Testing scuemata validity with invalid cue schemas - family missing", func(t *testing.T) {
		tempDir := os.DirFS(filepath.Join("testdata", "invalid_scuemata_missing_family"))

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       tempDir,
			DistPluginCueFS: pluginSchema,
		}

		err := validate(nil, baseLoadPaths, load.BaseDashboardFamily)
		assert.EqualError(t, err, "error while loading dashboard scuemata, err: dashboard schema family did not exist at expected path in expected file")
	})

	t.Run("Testing scuemata validity with invalid cue schemas - panel missing", func(t *testing.T) {
		tempDir := os.DirFS(filepath.Join("testdata", "invalid_scuemata_missing_panel"))

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       tempDir,
			DistPluginCueFS: pluginSchema,
		}

		err := validate(nil, baseLoadPaths, load.BaseDashboardFamily)
		require.NoError(t, err, "error while loading base dashboard scuemata")

		err = validate(nil, baseLoadPaths, load.DistDashboardFamily)
		assert.EqualError(t, err, "all schema should be valid with respect to basic CUE rules, Family.lineages.0.0: field #Panel not allowed")
	})

	t.Run("Testing scuemata validity against JSON files", func(t *testing.T) {
		tempDir := os.DirFS(filepath.Join("testdata", "valid_scuemata"))

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       tempDir,
			DistPluginCueFS: pluginSchema,
		}

		require.NoError(t, fs.WalkDir(tempDir, ".", func(path string, d fs.DirEntry, err error) error {
			require.NoError(t, err)

			if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
				return nil
			}

			if d.Name() == "valid.json" {
				t.Run(path, func(t *testing.T) {
					b, err := tempDir.Open(path)
					require.NoError(t, err, "failed to open dashboard file")

					err = validate(b, baseLoadPaths, load.BaseDashboardFamily)
					require.NoError(t, err, "error while loading base dashboard scuemata")

					err = validate(b, baseLoadPaths, load.DistDashboardFamily)
					require.NoError(t, err, "error while loading base dashboard scuemata")
				})
			}
			if d.Name() == "invalid.json" {
				t.Run(path, func(t *testing.T) {
					b, err := tempDir.Open(path)
					require.NoError(t, err, "failed to open dashboard file")

					err = validate(b, baseLoadPaths, load.BaseDashboardFamily)
					assert.EqualError(t, err, "invalid resource with respect to the schema, err: Family.lineages.0.0.panels.0.fieldConfig.defaults: field mappings not allowed")
				})
			}

			return nil
		}))
	})
}
