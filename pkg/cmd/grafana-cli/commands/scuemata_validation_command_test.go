package commands

import (
	"encoding/json"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"cuelang.org/go/cue/errors"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/laher/mergefs"
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

		err := validateScuemata(baseLoadPaths, load.BaseDashboardFamily)
		require.NoError(t, err, "error while loading base dashboard scuemata")

		err = validateScuemata(baseLoadPaths, load.DistDashboardFamily)
		require.NoError(t, err, "error while loading dist dashboard scuemata")
	})

	t.Run("Testing scuemata validity with invalid cue schemas - family missing", func(t *testing.T) {
		genCue, err := os.ReadFile("testdata/missing_family_gen.cue")
		require.NoError(t, err)

		filesystem := fstest.MapFS{
			"cue/data/gen.cue": &fstest.MapFile{Data: genCue},
		}
		mergedFS := mergefs.Merge(filesystem, defaultBaseLoadPaths.BaseCueFS)

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       mergedFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		err = validateScuemata(baseLoadPaths, load.BaseDashboardFamily)
		assert.EqualError(t, err, "error while loading dashboard scuemata, err: dashboard schema family did not exist at expected path in expected file")
	})

	t.Run("Testing scuemata validity with invalid cue schemas - panel missing ", func(t *testing.T) {
		genCue, err := os.ReadFile("testdata/missing_panel_gen.cue")
		require.NoError(t, err)

		filesystem := fstest.MapFS{
			"cue/data/gen.cue": &fstest.MapFile{Data: genCue},
		}
		mergedFS := mergefs.Merge(filesystem, defaultBaseLoadPaths.BaseCueFS)

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       mergedFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		err = validateScuemata(baseLoadPaths, load.BaseDashboardFamily)
		require.NoError(t, err, "error while loading base dashboard scuemata")

		err = validateScuemata(baseLoadPaths, load.DistDashboardFamily)
		assert.EqualError(t, err, "all schema should be valid with respect to basic CUE rules, Family.lineages.0.0: field #Panel not allowed")
	})

	t.Run("Testing validateResources against scuemata and resource inputs", func(t *testing.T) {
		validPanel, err := os.ReadFile("testdata/panels/valid_resource_panel.json")
		require.NoError(t, err)

		invalidPanel, err := os.ReadFile("testdata/panels/invalid_resource_panel.json")
		require.NoError(t, err)

		filesystem := fstest.MapFS{
			"valid.json":   &fstest.MapFile{Data: validPanel},
			"invalid.json": &fstest.MapFile{Data: invalidPanel},
		}
		mergedFS := mergefs.Merge(filesystem, defaultBaseLoadPaths.BaseCueFS)

		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       mergedFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		require.NoError(t, fs.WalkDir(mergedFS, ".", func(path string, d fs.DirEntry, err error) error {
			require.NoError(t, err)

			if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
				return nil
			}

			if d.Name() == "valid.json" {
				t.Run(path, func(t *testing.T) {
					b, err := mergedFS.Open(path)
					require.NoError(t, err, "failed to open dashboard file")
					res := schema.Resource{Value: b, Name: path}

					err = validateResources(res, baseLoadPaths, load.BaseDashboardFamily)
					require.NoError(t, err, "error while loading base dashboard scuemata")

					err = validateResources(res, baseLoadPaths, load.DistDashboardFamily)
					require.NoError(t, err, "error while loading dist dashboard scuemata")
				})
			}
			if d.Name() == "invalid.json" {
				t.Run(path, func(t *testing.T) {
					b, err := mergedFS.Open(path)
					require.NoError(t, err, "failed to open dashboard file")
					res := schema.Resource{Value: b, Name: path}

					err = validateResources(res, baseLoadPaths, load.BaseDashboardFamily)
					assert.EqualError(t, err, "failed validation: Family.lineages.0.0.panels.0.type: incomplete value !=\"\"")
				})
			}

			return nil
		}))
	})
}

func TestValidateDevenvDashboards(t *testing.T) {
	var baseLoadPaths = load.BaseLoadPaths{
		BaseCueFS:       defaultBaseLoadPaths.BaseCueFS,
		DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
	}
	base, err := load.BaseDashboardFamily(baseLoadPaths)
	dist, err := load.DistDashboardFamily(baseLoadPaths)
	require.NoError(t, err, "failed to load base dashboard family")

	require.NoError(t, filepath.Walk("../../../../devenv/dev-dashboards/", func(path string, info os.FileInfo, err error) error {
		require.NoError(t, err)
		if info.IsDir() {
			return nil
		}

		// Ignore gosec warning G304 since it's a test
		// nolint:gosec
		b, err := os.Open(path)
		require.NoError(t, err, "failed to open resource file")

		// Only try to validate dashboards with schemaVersion >= 30
		jtree := make(map[string]interface{})
		if byt, err := io.ReadAll(b); err != nil {
			t.Fatal(err)
		} else {
			json.Unmarshal(byt, &jtree)
		}

		if oldschemav, has := jtree["schemaVersion"]; !has {
			t.Logf("no schemaVersion in %s", path)
			return nil
		} else {
			if !(oldschemav.(float64) > 29) {
				t.Logf("schemaVersion is %v, older than 30, skipping %s", oldschemav, path)
				return nil
			}
		}

		res := schema.Resource{Value: b, Name: path}
		err = base.Validate(res)
		if err != nil {
			t.Fatal(errors.Details(err, nil))
		}
		err = dist.Validate(res)
		if err != nil {
			t.Fatal(errors.Details(err, nil))
		}
		return nil
	}))
}
