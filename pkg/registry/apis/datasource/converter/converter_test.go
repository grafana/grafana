package converter

import (
	"encoding/json"
	"errors"
	"maps"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

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

func TestAnnotations(t *testing.T) {
	converter := NewConverter(
		types.OrgNamespaceFormatter,
		"testdata.grafana.datasource.app",
		"grafana-testdata-datasource",
		[]string{"testdata"},
	)

	tests := []struct {
		name        string
		annotations map[string]string
		stored      map[string]string // the annotations column
		kind        string            // the manager_kind column
		identity    string            // the manager_identity column
	}{
		{
			name: "the manager goes to columns, the rest to the blob",
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:        string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity:    "my-repo",
				utils.AnnoKeyManagerAllowsEdits: "true",
				utils.AnnoKeySourcePath:         "datasources/prom.yaml",
				utils.AnnoKeySourceChecksum:     "abc123",
				utils.AnnoKeySourceTimestamp:    "1731283200000",
			},
			stored: map[string]string{
				utils.AnnoKeyManagerAllowsEdits: "true",
				utils.AnnoKeySourcePath:         "datasources/prom.yaml",
				utils.AnnoKeySourceChecksum:     "abc123",
				utils.AnnoKeySourceTimestamp:    "1731283200000",
			},
			kind:     string(utils.ManagerKindRepo),
			identity: "my-repo",
		},
		{
			name: "derived annotations are not in the blob",
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:      string(utils.ManagerKindTerraform),
				utils.AnnoKeyManagerIdentity:  "terraform-provider",
				utils.AnnoKeyUpdatedTimestamp: "2026-01-01T00:00:00Z",
			},
			kind:     string(utils.ManagerKindTerraform),
			identity: "terraform-provider",
		},
		{
			name: "annotations the converter does not know about are kept",
			annotations: map[string]string{
				utils.AnnoKeyMessage: "committed from the UI",
			},
			stored: map[string]string{
				utils.AnnoKeyMessage: "committed from the UI",
			},
		},
		{
			name: "only derived annotations stores nothing",
			annotations: map[string]string{
				utils.AnnoKeyUpdatedTimestamp: "2026-01-01T00:00:00Z",
			},
		},
		{
			name: "no annotations",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := &datasourceV0.DataSource{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "ds-uid",
					Namespace:   "default",
					Annotations: tt.annotations,
				},
			}

			add, err := converter.ToAddCommand(obj)
			require.NoError(t, err)
			require.Equal(t, tt.stored, add.Annotations)
			require.Equal(t, tt.kind, add.ManagerKind)
			require.Equal(t, tt.identity, add.ManagerIdentity)

			update, err := converter.ToUpdateCommand(obj)
			require.NoError(t, err)
			require.Equal(t, tt.stored, update.Annotations)
			require.Equal(t, tt.kind, update.ManagerKind)
			require.Equal(t, tt.identity, update.ManagerIdentity)
			require.True(t, update.UpdateAnnotations, "a PUT is authoritative for the annotations")

			// Reading puts the columns back alongside the blob.
			back, err := converter.AsDataSource(&datasources.DataSource{
				UID:             "ds-uid",
				Type:            "grafana-testdata-datasource",
				Annotations:     add.Annotations,
				ManagerKind:     add.ManagerKind,
				ManagerIdentity: add.ManagerIdentity,
			})
			require.NoError(t, err)

			wantBack := map[string]string{}
			maps.Copy(wantBack, tt.stored)
			if tt.kind != "" {
				wantBack[utils.AnnoKeyManagerKind] = tt.kind
			}
			if tt.identity != "" {
				wantBack[utils.AnnoKeyManagerIdentity] = tt.identity
			}
			if len(wantBack) == 0 {
				wantBack = nil
			}
			require.Equal(t, wantBack, back.Annotations)
		})
	}

	t.Run("manager and source properties survive the round trip", func(t *testing.T) {
		obj := &datasourceV0.DataSource{
			ObjectMeta: metav1.ObjectMeta{Name: "ds-uid", Namespace: "default"},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindRepo,
			Identity:    "my-repo",
			AllowsEdits: true,
		})
		meta.SetSourceProperties(utils.SourceProperties{
			Path:            "datasources/prom.yaml",
			Checksum:        "abc123",
			TimestampMillis: 1731283200000,
		})

		add, err := converter.ToAddCommand(obj)
		require.NoError(t, err)

		back, err := converter.AsDataSource(&datasources.DataSource{
			UID:             "ds-uid",
			Type:            "grafana-testdata-datasource",
			Annotations:     add.Annotations,
			ManagerKind:     add.ManagerKind,
			ManagerIdentity: add.ManagerIdentity,
		})
		require.NoError(t, err)

		backMeta, err := utils.MetaAccessor(back)
		require.NoError(t, err)

		manager, managed := backMeta.GetManagerProperties()
		require.True(t, managed)
		require.Equal(t, utils.ManagerProperties{
			Kind:        utils.ManagerKindRepo,
			Identity:    "my-repo",
			AllowsEdits: true,
		}, manager)

		source, hasSource := backMeta.GetSourceProperties()
		require.True(t, hasSource)
		require.Equal(t, utils.SourceProperties{
			Path:            "datasources/prom.yaml",
			Checksum:        "abc123",
			TimestampMillis: 1731283200000,
		}, source)
	})
}
