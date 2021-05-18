package commands

import (
	"os"
	"testing"
	"testing/fstest"

	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var defaultBaseLoadPaths = load.GetDefaultLoadPaths()

func TestValidateScuemataBasics(t *testing.T) {
	t.Run("Testing scuemata validity with valid cue schemas", func(t *testing.T) {
		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       defaultBaseLoadPaths.BaseCueFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		err := validate(baseLoadPaths, load.BaseDashboardFamily)
		require.NoError(t, err, "error while loading base dashboard scuemata")

		err = validate(baseLoadPaths, load.DistDashboardFamily)
		require.NoError(t, err, "error while loading dist dashboard scuemata")
	})

	t.Run("Testing scuemata validity with invalid cue schemas - family missing", func(t *testing.T) {
		genCue, err := os.ReadFile("testdata/missing_family_gen.cue")
		require.NoError(t, err)

		fs := fstest.MapFS{
			"cue/data/gen.cue": &fstest.MapFile{Data: genCue},
		}
		mergedFS := Merge(fs, defaultBaseLoadPaths.BaseCueFS)

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       mergedFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		err = validate(baseLoadPaths, load.BaseDashboardFamily)
		assert.EqualError(t, err, "error while loading dashboard scuemata, err: dashboard schema family did not exist at expected path in expected file")
	})

	t.Run("Testing scuemata validity with invalid cue schemas - panel missing ", func(t *testing.T) {
		genCue, err := os.ReadFile("testdata/missing_panel_gen.cue")
		require.NoError(t, err)

		fs := fstest.MapFS{
			"cue/data/gen.cue": &fstest.MapFile{Data: genCue},
		}
		mergedFS := Merge(fs, defaultBaseLoadPaths.BaseCueFS)

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       mergedFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		err = validate(baseLoadPaths, load.BaseDashboardFamily)
		require.NoError(t, err, "error while loading base dashboard scuemata")

		err = validate(baseLoadPaths, load.DistDashboardFamily)
		assert.EqualError(t, err, "all schema should be valid with respect to basic CUE rules, Family.lineages.0.0: field #Panel not allowed")
	})
}
