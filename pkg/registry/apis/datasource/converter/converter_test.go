package converter

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	jsonpatch "gopkg.in/evanphx/json-patch.v4"

	"github.com/grafana/authlib/types"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestUpdateCommandBasicAuthUserPatchSemantics(t *testing.T) {
	base := []byte(`{"apiVersion":"prometheus.datasource.grafana.app/v0alpha1","kind":"DataSource","metadata":{"name":"example","namespace":"default"},"spec":{"title":"example","basicAuthUser":"original-user"}}`)
	converter := NewConverter(types.OrgNamespaceFormatter, "prometheus.datasource.grafana.app", "prometheus", []string{"prometheus"})
	for _, tc := range []struct {
		name      string
		patch     string
		jsonPatch bool
		want      string
	}{
		{name: "merge patch unrelated field", patch: `{"spec":{"title":"updated"}}`, want: "original-user"},
		{name: "merge patch empty username", patch: `{"spec":{"basicAuthUser":""}}`},
		{name: "merge patch removes username", patch: `{"spec":{"basicAuthUser":null}}`},
		{name: "JSON patch unrelated field", patch: `[{"op":"replace","path":"/spec/title","value":"updated"}]`, jsonPatch: true, want: "original-user"},
		{name: "JSON patch removes username", patch: `[{"op":"remove","path":"/spec/basicAuthUser"}]`, jsonPatch: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var raw []byte
			var err error
			if tc.jsonPatch {
				patch, decodeErr := jsonpatch.DecodePatch([]byte(tc.patch))
				require.NoError(t, decodeErr)
				raw, err = patch.Apply(base)
			} else {
				raw, err = jsonpatch.MergePatch(base, []byte(tc.patch))
			}
			require.NoError(t, err)
			var ds datasourceV0.DataSource
			require.NoError(t, json.Unmarshal(raw, &ds))
			cmd, err := converter.ToUpdateCommand(&ds)
			require.NoError(t, err)
			require.True(t, cmd.BasicAuthUserSet)
			require.Equal(t, tc.want, cmd.BasicAuthUser)
		})
	}
}

func TestConverter(t *testing.T) {
	t.Run("resource to command", func(t *testing.T) {
		converter := NewConverter(
			types.OrgNamespaceFormatter,
			"testdata.grafana.datasource.app",
			"grafana-testdata-datasource",
			[]string{"testdata"},
		)
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
				obj := &datasourceV0.DataSource{}
				fpath := filepath.Join("testdata", tt.name+".json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, obj)
				require.NoError(t, err)

				// The add command
				fpath = filepath.Join("testdata", tt.name+"-to-cmd-add.json")
				add, err := converter.ToAddCommand(obj)
				if tt.expectedErr != "" {
					require.ErrorContains(t, err, tt.expectedErr)
					require.Nil(t, add, "cmd should be nil when error exists")

					update, err := converter.ToUpdateCommand(obj)
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
				update, err := converter.ToUpdateCommand(obj)
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

				roundtrip, err := converter.AsDataSource(ds)
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
		converter := NewConverter(
			types.OrgNamespaceFormatter,
			"testdata.grafana.datasource.app",
			"grafana-testdata-datasource",
			[]string{"testdata"},
		)
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

				obj, err := converter.AsDataSource(ds)
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

	t.Run("resource to legacy", func(t *testing.T) {
		converter := NewConverter(
			types.OrgNamespaceFormatter,
			"testdata.grafana.datasource.app",
			"grafana-testdata-datasource",
			[]string{"testdata"},
		)
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
				ds := &datasourceV0.DataSource{}
				fpath := filepath.Join("testdata", tt.name+".json")
				raw, err := os.ReadFile(fpath) // nolint:gosec
				require.NoError(t, err)
				err = json.Unmarshal(raw, ds)
				require.NoError(t, err)

				legacyDS, err := converter.AsLegacyDatasource(ds)
				if tt.expectedErr != "" {
					require.ErrorContains(t, err, tt.expectedErr)
					require.Nil(t, legacyDS, "object should be nil when error exists")
				} else {
					require.NoError(t, err)
				}

				// Verify the result
				fpath = filepath.Join("testdata", tt.name+"-to-legacy.json")
				if legacyDS == nil {
					_, err := os.Stat(fpath)
					require.Error(t, err, "file should not exist")
					require.True(t, errors.Is(err, os.ErrNotExist))
				} else {
					out, err := json.MarshalIndent(legacyDS, "", "  ")
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

func TestConverter_DefaultLabel(t *testing.T) {
	converter := NewConverter(types.OrgNamespaceFormatter, "testdata.grafana.datasource.app", "grafana-testdata-datasource", nil)
	for _, tt := range []struct {
		name      string
		spec      map[string]any
		labels    map[string]string
		isDefault bool
	}{
		{name: "no default", spec: map[string]any{}},
		{name: "label only", spec: map[string]any{}, labels: map[string]string{"default": "true"}, isDefault: true},
		{name: "label overrides false spec", spec: map[string]any{"isDefault": false}, labels: map[string]string{"default": "true"}, isDefault: true},
		{name: "legacy spec only", spec: map[string]any{"isDefault": true}, isDefault: true},
		{name: "false label preserves true spec", spec: map[string]any{"isDefault": true}, labels: map[string]string{"default": "false"}, isDefault: true},
		{name: "false label", spec: map[string]any{}, labels: map[string]string{"default": "false"}},
		{name: "unrelated label", spec: map[string]any{}, labels: map[string]string{"environment": "test"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ds := &datasourceV0.DataSource{Spec: datasourceV0.UnstructuredSpec{Object: tt.spec}}
			ds.Name = "test"
			ds.Namespace = "default"
			ds.Labels = tt.labels

			add, err := converter.ToAddCommand(ds)
			require.NoError(t, err)
			assert.Equal(t, tt.isDefault, add.IsDefault, "create")

			update, err := converter.ToUpdateCommand(ds)
			require.NoError(t, err)
			assert.Equal(t, tt.isDefault, update.IsDefault, "update")

			legacy, err := converter.AsLegacyDatasource(ds)
			require.NoError(t, err)
			assert.Equal(t, tt.isDefault, legacy.IsDefault, "legacy conversion")
		})
	}
}
