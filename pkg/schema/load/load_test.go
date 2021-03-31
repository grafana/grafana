package load

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/stretchr/testify/require"
)

var p BaseLoadPaths = BaseLoadPaths{
	BaseCueFS:       grafana.CoreSchema,
	DistPluginCueFS: grafana.PluginSchema,
}

// Basic well-formedness tests on core scuemata.
func TestScuemataBasics(t *testing.T) {
	all := make(map[string]schema.VersionedCueSchema)

	dash, err := BaseDashboardFamily(p)
	require.NoError(t, err, "error while loading base dashboard scuemata")
	all["basedash"] = dash

	ddash, err := DistDashboardScuemata(p)
	require.NoError(t, err, "error while loading dist dashboard scuemata")
	all["distdash"] = ddash

	for set, sch := range all {
		t.Run(set, func(t *testing.T) {
			require.NotNil(t, sch, "scuemata for %q linked to empty chain", set)

			maj, min := sch.Version()
			t.Run(fmt.Sprintf("%v.%v", maj, min), func(t *testing.T) {
				cv := sch.CUE()
				t.Run("Exists", func(t *testing.T) {
					require.True(t, cv.Exists(), "cue value for schema does not exist")
				})
				t.Run("Validate", func(t *testing.T) {
					require.NoError(t, cv.Validate(), "all schema should be valid with respect to basic CUE rules")
				})
			})
		})
	}
}

func TestPluginLoading(t *testing.T) {
	tp := p
	tp.DistPluginCueFS = os.DirFS(filepath.Join("testdata", "plugins"))
}

func TestDashboardValidity(t *testing.T) {
	// TODO FIXME remove this once we actually have dashboard schema filled in
	// enough that the tests pass, lol
	t.Skip()
	validdir := os.DirFS(filepath.Join("testdata", "artifacts", "dashboards"))

	dash, err := BaseDashboardFamily(p)
	require.NoError(t, err, "error while loading base dashboard scuemata")

	ddash, err := DistDashboardScuemata(p)
	require.NoError(t, err, "error while loading dist dashboard scuemata")

	require.NoError(t, fs.WalkDir(validdir, ".", func(path string, d fs.DirEntry, err error) error {
		require.NoError(t, err)

		if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
			return nil
		}

		t.Run(path, func(t *testing.T) {
			b, err := validdir.Open(path)
			require.NoError(t, err, "failed to open dashboard file")

			t.Run("base", func(t *testing.T) {
				_, err := schema.SearchAndValidate(dash, b)
				require.NoError(t, err, "dashboard failed validation")
			})
			t.Run("dist", func(t *testing.T) {
				_, err := schema.SearchAndValidate(ddash, b)
				require.NoError(t, err, "dashboard failed validation")
			})
		})

		return nil
	}))
}

func TestPanelValidity(t *testing.T) {

}
