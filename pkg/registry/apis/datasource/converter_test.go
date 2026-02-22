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
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
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

func TestFromUpdateCommand(t *testing.T) {
	converter := NewConverter(
		types.OrgNamespaceFormatter,
		"prometheus.datasource.grafana.app",
		"prometheus",
		[]string{},
	)

	t.Run("converts basic fields", func(t *testing.T) {
		cmd := &datasources.UpdateDataSourceCommand{
			UID:             "test-uid",
			OrgID:           1,
			Name:            "Test Prometheus",
			Access:          datasources.DS_ACCESS_PROXY,
			URL:             "http://localhost:9090",
			Database:        "mydb",
			User:            "myuser",
			BasicAuth:       true,
			BasicAuthUser:   "basicuser",
			WithCredentials: true,
			IsDefault:       true,
			ReadOnly:        false,
		}

		ds, err := converter.FromUpdateCommand(cmd, "v0alpha1")
		require.NoError(t, err)

		assert.Equal(t, "prometheus.datasource.grafana.app/v0alpha1", ds.APIVersion)
		assert.Equal(t, "DataSource", ds.Kind)
		assert.Equal(t, "test-uid", ds.Name)
		assert.Equal(t, "default", ds.Namespace) // OrgNamespaceFormatter maps org 1 to "default"

		assert.Equal(t, "Test Prometheus", ds.Spec.Title())
		assert.Equal(t, "proxy", string(ds.Spec.Access()))
		assert.Equal(t, "http://localhost:9090", ds.Spec.URL())
		assert.Equal(t, "mydb", ds.Spec.Database())
		assert.Equal(t, "myuser", ds.Spec.User())
		assert.True(t, ds.Spec.BasicAuth())
		assert.Equal(t, "basicuser", ds.Spec.BasicAuthUser())
		assert.True(t, ds.Spec.WithCredentials())
		assert.True(t, ds.Spec.IsDefault())
		assert.False(t, ds.Spec.ReadOnly())
	})

	t.Run("converts jsonData", func(t *testing.T) {
		jsonData := simplejson.NewFromAny(map[string]any{
			"httpMethod": "POST",
			"timeout":    30,
		})
		cmd := &datasources.UpdateDataSourceCommand{
			UID:      "test-uid",
			OrgID:    1,
			Name:     "Test",
			Access:   datasources.DS_ACCESS_PROXY,
			JsonData: jsonData,
		}

		ds, err := converter.FromUpdateCommand(cmd, "v0alpha1")
		require.NoError(t, err)

		specJsonData := ds.Spec.JSONData()
		require.NotNil(t, specJsonData)
		jsonDataMap, ok := specJsonData.(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "POST", jsonDataMap["httpMethod"])
		assert.Equal(t, 30, jsonDataMap["timeout"])
	})

	t.Run("converts secureJsonData", func(t *testing.T) {
		cmd := &datasources.UpdateDataSourceCommand{
			UID:    "test-uid",
			OrgID:  1,
			Name:   "Test",
			Access: datasources.DS_ACCESS_PROXY,
			SecureJsonData: map[string]string{
				"password":          "secret123",
				"basicAuthPassword": "basicSecret",
			},
		}

		ds, err := converter.FromUpdateCommand(cmd, "v0alpha1")
		require.NoError(t, err)

		require.Len(t, ds.Secure, 2)
		assert.Equal(t, "secret123", string(ds.Secure["password"].Create))
		assert.Equal(t, "basicSecret", string(ds.Secure["basicAuthPassword"].Create))
	})

	t.Run("empty jsonData is not set", func(t *testing.T) {
		cmd := &datasources.UpdateDataSourceCommand{
			UID:      "test-uid",
			OrgID:    1,
			Name:     "Test",
			Access:   datasources.DS_ACCESS_PROXY,
			JsonData: simplejson.New(),
		}

		ds, err := converter.FromUpdateCommand(cmd, "v0alpha1")
		require.NoError(t, err)
		assert.Nil(t, ds.Spec.JSONData())
	})

	t.Run("nil secureJsonData results in nil Secure", func(t *testing.T) {
		cmd := &datasources.UpdateDataSourceCommand{
			UID:    "test-uid",
			OrgID:  1,
			Name:   "Test",
			Access: datasources.DS_ACCESS_PROXY,
		}

		ds, err := converter.FromUpdateCommand(cmd, "v0alpha1")
		require.NoError(t, err)
		assert.Nil(t, ds.Secure)
	})

	t.Run("empty secureJsonData value sets Remove flag", func(t *testing.T) {
		cmd := &datasources.UpdateDataSourceCommand{
			UID:    "test-uid",
			OrgID:  1,
			Name:   "Test",
			Access: datasources.DS_ACCESS_PROXY,
			SecureJsonData: map[string]string{
				"password":          "",       // empty string = remove
				"basicAuthPassword": "secret", // non-empty = create
			},
		}

		ds, err := converter.FromUpdateCommand(cmd, "v0alpha1")
		require.NoError(t, err)

		require.Len(t, ds.Secure, 2)
		// Empty string should set Remove: true
		assert.True(t, ds.Secure["password"].Remove)
		assert.Empty(t, ds.Secure["password"].Create)
		// Non-empty string should set Create
		assert.False(t, ds.Secure["basicAuthPassword"].Remove)
		assert.Equal(t, "secret", string(ds.Secure["basicAuthPassword"].Create))
	})
}
