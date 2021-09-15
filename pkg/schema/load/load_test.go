package load

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/load"
	cuejson "cuelang.org/go/pkg/encoding/json"
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
	validdir := filepath.Join("..", "..", "..", "devenv", "dev-dashboards")

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
						if testing.Verbose() {
							t.Logf("schemaVersion is %v, older than 30, skipping %s", oldschemav, path)
						}
						return nil
					}
				}

				t.Run(filepath.Base(path), func(t *testing.T) {
					err := sch.Validate(schema.Resource{Value: byt, Name: path})
					if err != nil {
						// Testify trims errors to short length. We want the full text
						errstr := errors.Details(err, nil)
						t.Log(errstr)
						if strings.Contains(errstr, "null") {
							t.Log("validation failure appears to involve nulls - see if scripts/stripnulls.sh has any effect?")
						}
						t.FailNow()
					}
				})

				return nil
			}))
		}
	}

	// TODO will need to expand this appropriately when the scuemata contain
	// more than one schema

	dash, err := BaseDashboardFamily(p)
	require.NoError(t, err, "error while loading base dashboard scuemata")
	t.Run("base", doTest(dash))

	ddash, err := DistDashboardFamily(p)
	require.NoError(t, err, "error while loading dist dashboard scuemata")
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
	a := fstest.MapFS{
		filepath.Join(dashboardDir, "dashboard.cue"): &fstest.MapFile{Data: []byte("package dashboard\n{;;;;;;;;}")},
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
}

func TestAllPluginsInDist(t *testing.T) {
	overlay, err := defaultOverlay(p)
	require.NoError(t, err)

	cfg := &load.Config{
		Overlay:    overlay,
		ModuleRoot: prefix,
		Module:     "github.com/grafana/grafana",
		Dir:        filepath.Join(prefix, dashboardDir, "dist"),
		Package:    "dist",
	}
	inst, err := rt.Build(load.Instances(nil, cfg)[0])
	require.NoError(t, err)

	dinst, err := rt.Compile("str", `
	Family: compose: Panel: {}
	typs: [for typ, _ in Family.compose.Panel {typ}]
	`)
	require.NoError(t, err)

	typs := dinst.Value().Unify(inst.Value()).LookupPath(cue.MakePath(cue.Str("typs")))
	j, err := cuejson.Marshal(typs)
	require.NoError(t, err)

	var importedPanelTypes, loadedPanelTypes []string
	require.NoError(t, json.Unmarshal([]byte(j), &importedPanelTypes))

	// TODO a more canonical way of getting all the dist plugin types with
	// models.cue would be nice.
	m, err := loadPanelScuemata(p)
	require.NoError(t, err)

	for typ := range m {
		loadedPanelTypes = append(loadedPanelTypes, typ)
	}

	sort.Strings(importedPanelTypes)
	sort.Strings(loadedPanelTypes)

	require.Equal(t, loadedPanelTypes, importedPanelTypes, "%s/family.cue needs updating, it must compose the same set of panel plugin models that are found by the plugin loader", cfg.Dir)
}
