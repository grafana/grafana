package load

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"cuelang.org/go/cue/errors"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/laher/mergefs"
	"github.com/stretchr/testify/require"
)

var p = GetDefaultLoadPaths()

// Basic well-formedness tests on core scuemata.
func TestScuemataBasics(t *testing.T) {
	all := make(map[string]schema.VersionedCueSchema)

	dash, err := BaseDashboardFamily(p)
	require.NoError(t, err, "error while loading base dashboard scuemata")
	all["basedash"] = dash

	ddash, err := DistDashboardFamily(p)
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

func TestDevenvDashboardValidity(t *testing.T) {
	// TODO un-skip when tests pass on all devenv dashboards
	t.Skip()
	// validdir := os.DirFS(filepath.Join("..", "..", "..", "devenv", "dev-dashboards"))
	validdir := filepath.Join("..", "..", "..", "devenv", "dev-dashboards")

	dash, err := BaseDashboardFamily(p)
	require.NoError(t, err, "error while loading base dashboard scuemata")

	ddash, err := DistDashboardFamily(p)
	require.NoError(t, err, "error while loading dist dashboard scuemata")

	doTest := func(sch schema.VersionedCueSchema) func(t *testing.T) {
		return func(t *testing.T) {
			t.Parallel()
			require.NoError(t, filepath.Walk(validdir, func(path string, d fs.FileInfo, err error) error {
				require.NoError(t, err)

				if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
					return nil
				}

				// Ignore gosec warning G304 since it's a test
				// nolint:gosec
				b, err := os.Open(path)
				require.NoError(t, err, "failed to open dashboard file")

				// Only try to validate dashboards with schemaVersion >= 30
				jtree := make(map[string]interface{})
				byt, err := io.ReadAll(b)
				if err != nil {
					t.Fatal(err)
				}
				require.NoError(t, json.Unmarshal(byt, &jtree))
				if oldschemav, has := jtree["schemaVersion"]; !has {
					t.Logf("no schemaVersion in %s", path)
					return nil
				} else {
					if !(oldschemav.(float64) > 29) {
						t.Logf("schemaVersion is %v, older than 30, skipping %s", oldschemav, path)
						return nil
					}
				}

				t.Run(filepath.Base(path), func(t *testing.T) {
					err := sch.Validate(schema.Resource{Value: byt, Name: path})
					if err != nil {
						// Testify trims errors to short length. We want the full text
						t.Fatal(errors.Details(err, nil))
					}
				})

				return nil
			}))
		}
	}

	// TODO will need to expand this appropriately when the scuemata contain
	// more than one schema
	t.Run("base", doTest(dash))
	t.Run("dist", doTest(ddash))
}

func TestPanelValidity(t *testing.T) {
	t.Skip()
	validdir := os.DirFS(filepath.Join("testdata", "artifacts", "panels"))

	ddash, err := DistDashboardFamily(p)
	require.NoError(t, err, "error while loading dist dashboard scuemata")

	// TODO hmm, it's awkward for this test's structure to have to pick just one
	// type of panel plugin, but we can change the test structure. However, is
	// there any other situation where we want the panel subschema with all
	// possible disjunctions? If so, maybe the interface needs work. Or maybe
	// just defer that until the proper generic composite scuemata impl.
	dpan, err := ddash.(CompositeDashboardSchema).LatestPanelSchemaFor("table")
	require.NoError(t, err, "error while loading panel subschema")

	require.NoError(t, fs.WalkDir(validdir, ".", func(path string, d fs.DirEntry, err error) error {
		require.NoError(t, err)

		if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
			return nil
		}

		t.Run(path, func(t *testing.T) {
			// TODO FIXME stop skipping once we actually have the schema filled in
			// enough that the tests pass, lol

			b, err := validdir.Open(path)
			require.NoError(t, err, "failed to open panel file")

			err = dpan.Validate(schema.Resource{Value: b})
			require.NoError(t, err, "panel failed validation")
		})

		return nil
	}))
}

func TestCueErrorWrapper(t *testing.T) {
	t.Run("Testing cue error wrapper", func(t *testing.T) {
		a := fstest.MapFS{
			"cue/data/gen.cue": &fstest.MapFile{Data: []byte("{;;;;;;;;}")},
		}

		filesystem := mergefs.Merge(a, GetDefaultLoadPaths().BaseCueFS)

		var baseLoadPaths = BaseLoadPaths{
			BaseCueFS:       filesystem,
			DistPluginCueFS: GetDefaultLoadPaths().DistPluginCueFS,
		}

		_, err := BaseDashboardFamily(baseLoadPaths)
		require.Error(t, err)
		require.Contains(t, err.Error(), "in file")
		require.Contains(t, err.Error(), "line: ")

		_, err = DistDashboardFamily(baseLoadPaths)
		require.Error(t, err)
		require.Contains(t, err.Error(), "in file")
		require.Contains(t, err.Error(), "line: ")
	})
}
