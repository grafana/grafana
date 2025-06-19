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
)

func TestConverter(t *testing.T) {
	t.Run("resource to command", func(t *testing.T) {
		obj := &v0alpha1.GenericDataSource{}
		converter := converter{
			mapper: types.OrgNamespaceFormatter,
			dstype: "test-datasource",
		}
		check := []string{
			"convert-testdata-A",
		}
		for _, name := range check {
			t.Run(name, func(t *testing.T) {
				fpath := filepath.Join("testdata", name+"-input.json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, obj)
				require.NoError(t, err)

				// The add command
				fpath = filepath.Join("testdata", name+"-output-add.json")
				add, err := converter.toAddCommand(obj)
				require.NoError(t, err)
				out, err := json.MarshalIndent(add, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}

				// The update command
				fpath = filepath.Join("testdata", name+"-output-update.json")
				update, err := converter.toUpdateCommand(obj)
				require.NoError(t, err)
				out, err = json.MarshalIndent(update, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}
			})
		}
	})
}
