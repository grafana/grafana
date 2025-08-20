package datasource

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestConverter(t *testing.T) {
	t.Run("resource to command", func(t *testing.T) {
		converter := converter{
			mapper: types.OrgNamespaceFormatter,
			dstype: "test-datasource",
			group:  "testdata.grafana.datasource.app",
		}
		check := []string{
			"convert-resource-A",
		}
		for _, name := range check {
			t.Run(name, func(t *testing.T) {
				obj := &v0alpha1.DataSource{}
				fpath := filepath.Join("testdata", name+".json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, obj)
				require.NoError(t, err)

				// The add command
				fpath = filepath.Join("testdata", name+"-to-cmd-add.json")
				add, err := converter.toAddCommand(obj)
				require.NoError(t, err)
				out, err := json.MarshalIndent(add, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}

				// The update command
				fpath = filepath.Join("testdata", name+"-to-cmd-update.json")
				update, err := converter.toUpdateCommand(obj)
				require.NoError(t, err)
				out, err = json.MarshalIndent(update, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}

				// Round trip the update (NOTE, not all properties will be included)
				ds := &datasources.DataSource{}
				err = json.Unmarshal(raw, ds) // the add command is also a DataSource
				require.NoError(t, err)

				roundtrip, err := converter.asDataSource(ds)
				require.NoError(t, err)

				fpath = filepath.Join("testdata", name+"-to-cmd-update-roundtrip.json")
				out, err = json.MarshalIndent(roundtrip, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}
			})
		}
	})

	t.Run("db to resource", func(t *testing.T) {
		converter := converter{
			mapper: types.OrgNamespaceFormatter,
			dstype: "test-datasource",
			group:  "testdata.grafana.datasource.app",
		}
		check := []string{
			"convert-db-B",
		}
		for _, name := range check {
			t.Run(name, func(t *testing.T) {
				ds := &datasources.DataSource{}
				fpath := filepath.Join("testdata", name+".json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, ds)
				require.NoError(t, err)

				// if true {
				// 	ds.Created = time.Unix(100000000, 0).UTC()
				// 	ds.Updated = time.Unix(500000000, 0).UTC()
				// 	out, _ := json.MarshalIndent(ds, "", "  ")
				// 	fmt.Printf("%s\n", string(out))
				// 	t.FailNow()
				// }

				// As an object
				fpath = filepath.Join("testdata", name+"-to-resource.json")
				obj, err := converter.asDataSource(ds)
				require.NoError(t, err)
				out, err := json.MarshalIndent(obj, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}
			})
		}
	})
}
