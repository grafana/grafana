package datasource

import (
	"encoding/json"
	"errors"
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
			plugin: "grafana-testdata-datasource",
			alias:  []string{"testdata"},
			group:  "testdata.grafana.datasource.app",
		}
		tests := []struct {
			name        string
			expectedErr string
		}{
			{"convert-resource-full", ""},
			{"convert-resource-empty", ""},
			{"convert-resource-invalid", "expecting APIGroup: testdata.grafana.datasource.app"},
			{"convert-resource-invalid2", "invalid stack id"},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				obj := &v0alpha1.DataSource{}
				fpath := filepath.Join("testdata", tt.name+".json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, obj)
				require.NoError(t, err)

				// The add command
				fpath = filepath.Join("testdata", tt.name+"-to-cmd-add.json")
				add, err := converter.toAddCommand(obj)
				if tt.expectedErr != "" {
					require.ErrorContains(t, err, tt.expectedErr)
					require.Nil(t, add, "cmd should be nil when error exists")

					update, err := converter.toUpdateCommand(obj)
					require.ErrorContains(t, err, tt.expectedErr)
					require.Nil(t, update, "cmd should be nil when error exists")
					return
				}

				require.NoError(t, err)
				out, err := json.MarshalIndent(add, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}

				// The update command
				fpath = filepath.Join("testdata", tt.name+"-to-cmd-update.json")
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

				fpath = filepath.Join("testdata", tt.name+"-to-cmd-update-roundtrip.json")
				out, err = json.MarshalIndent(roundtrip, "", "  ")
				require.NoError(t, err)
				raw, _ = os.ReadFile(fpath) // nolint:gosec
				if !assert.JSONEq(t, string(raw), string(out)) {
					_ = os.WriteFile(fpath, out, 0600)
				}
			})
		}
	})

	t.Run("dto to resource", func(t *testing.T) {
		converter := converter{
			mapper: types.OrgNamespaceFormatter,
			plugin: "grafana-testdata-datasource",
			alias:  []string{"testdata"},
			group:  "testdata.grafana.datasource.app",
		}
		tests := []struct {
			name        string
			expectedErr string
		}{
			{
				name: "convert-dto-testdata",
			},
			{
				name: "convert-dto-empty",
			},
			{
				name:        "convert-dto-invalid",
				expectedErr: "expected datasource type: grafana-testdata-datasource [testdata]",
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				ds := &datasources.DataSource{}
				fpath := filepath.Join("testdata", tt.name+".json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, ds)
				require.NoError(t, err)

				obj, err := converter.asDataSource(ds)
				if tt.expectedErr != "" {
					require.ErrorContains(t, err, tt.expectedErr)
					require.Nil(t, obj, "object should be nil when error exists")
				} else {
					require.NoError(t, err)
				}

				// Verify the result
				fpath = filepath.Join("testdata", tt.name+"-to-resource.json")
				if obj == nil {
					_, err := os.Stat(fpath)
					require.Error(t, err, "file should not exist")
					require.True(t, errors.Is(err, os.ErrNotExist))
				} else {
					out, err := json.MarshalIndent(obj, "", "  ")
					require.NoError(t, err)
					raw, _ = os.ReadFile(fpath) // nolint:gosec
					if !assert.JSONEq(t, string(raw), string(out)) {
						_ = os.WriteFile(fpath, out, 0600)
					}
				}
			})
		}
	})
}
