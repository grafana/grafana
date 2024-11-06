package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	pluginfakes "github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	// testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type dataSourceMockRetriever struct {
	res []*datasources.DataSource
}

func (d *dataSourceMockRetriever) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	for _, dataSource := range d.res {
		idMatch := query.ID != 0 && query.ID == dataSource.ID
		uidMatch := query.UID != "" && query.UID == dataSource.UID
		nameMatch := query.Name != "" && query.Name == dataSource.Name
		if idMatch || nameMatch || uidMatch {
			return dataSource, nil
		}
	}
	return nil, datasources.ErrDataSourceNotFound
}

func TestService_AddDataSource(t *testing.T) {
	t.Run("should not fail if the plugin is not installed", func(t *testing.T) {
		dsService := initDSService(t)
		dsService.pluginStore = &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{}, // empty list
		}

		cmd := &datasources.AddDataSourceCommand{
			OrgID: 1,
			Type:  datasources.DS_TESTDATA,
			Name:  "test",
		}

		ds, err := dsService.AddDataSource(context.Background(), cmd)
		require.NoError(t, err)
		require.Equal(t, "test", ds.Name)
	})

	t.Run("should fail if the datasource name is too long", func(t *testing.T) {
		dsService := initDSService(t)

		cmd := &datasources.AddDataSourceCommand{
			OrgID: 1,
			Name:  string(make([]byte, 256)),
		}

		_, err := dsService.AddDataSource(context.Background(), cmd)
		require.EqualError(t, err, "[datasource.nameInvalid] max length is 190")
	})

	t.Run("should fail if the datasource url is invalid", func(t *testing.T) {
		dsService := initDSService(t)

		cmd := &datasources.AddDataSourceCommand{
			OrgID: 1,
			URL:   string(make([]byte, 256)),
		}

		_, err := dsService.AddDataSource(context.Background(), cmd)
		require.EqualError(t, err, "[datasource.urlInvalid] max length is 255")
	})

	t.Run("should fail if the datasource managed permissions fail", func(t *testing.T) {
		dsService := initDSService(t)
		enableRBACManagedPermissions(t, dsService.cfg)
		dsService.permissionsService = &actest.FakePermissionsService{
			ExpectedErr: errors.New("failed to set datasource permissions"),
		}
		dsService.pluginStore = &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{},
		}

		cmd := &datasources.AddDataSourceCommand{
			OrgID: 1,
			Type:  datasources.DS_TESTDATA,
			Name:  "test",
		}

		ds, err := dsService.AddDataSource(context.Background(), cmd)
		assert.Nil(t, ds)
		assert.ErrorContains(t, err, "failed to set datasource permissions")
	})

	t.Run("if a plugin has an API version defined (EXPERIMENTAL)", func(t *testing.T) {
		t.Run("should success to run admission hooks", func(t *testing.T) {
			dsService := initDSService(t)
			validateExecuted := false
			dsService.pluginStore = &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{{
					JSONData: plugins.JSONData{
						ID:   "test",
						Type: plugins.TypeDataSource,
						Name: "test",
					},
				}},
			}
			dsService.pluginClient = &pluginfakes.FakePluginClient{
				ValidateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
					validateExecuted = true
					return &backend.ValidationResponse{
						Allowed: true,
					}, nil
				},
				MutateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
					return &backend.MutationResponse{
						Allowed:     true,
						ObjectBytes: req.ObjectBytes,
					}, nil
				},
			}
			cmd := &datasources.AddDataSourceCommand{
				OrgID:      1,
				Type:       "test", // required to validate apiserver
				Name:       "test",
				APIVersion: "v1",
			}
			_, err := dsService.AddDataSource(context.Background(), cmd)
			require.NoError(t, err)
			require.True(t, validateExecuted)
		})

		t.Run("should ignore if AdmissionHandler is not implemented for v0alpha1", func(t *testing.T) {
			dsService := initDSService(t)
			dsService.pluginStore = &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{{
					JSONData: plugins.JSONData{
						ID:   "test",
						Type: plugins.TypeDataSource,
						Name: "test",
					},
				}},
			}
			dsService.pluginClient = &pluginfakes.FakePluginClient{}
			cmd := &datasources.AddDataSourceCommand{
				OrgID:      1,
				Type:       "test", // required to validate apiserver
				Name:       "test",
				APIVersion: "v0alpha1",
			}
			_, err := dsService.AddDataSource(context.Background(), cmd)
			require.NoError(t, err)
		})

		t.Run("should fail at validation", func(t *testing.T) {
			dsService := initDSService(t)
			dsService.pluginStore = &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{{
					JSONData: plugins.JSONData{
						ID:   "test",
						Type: plugins.TypeDataSource,
						Name: "test",
					},
				}},
			}
			dsService.pluginClient = &pluginfakes.FakePluginClient{
				ValidateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
					settings, err := backend.DataSourceInstanceSettingsFromProto(req.ObjectBytes, "")
					if err != nil {
						return nil, err
					}
					if settings.APIVersion != "v0alpha1" {
						return &backend.ValidationResponse{
							Allowed: false,
							Result: &backend.StatusResult{
								Status:  "Failure",
								Message: fmt.Sprintf("expected apiVersion: v0alpha1, found: %s", settings.APIVersion),
								Reason:  "badRequest",
								Code:    http.StatusBadRequest,
							},
						}, nil
					}
					return &backend.ValidationResponse{
						Allowed: true,
					}, nil
				},
				MutateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
					return nil, fmt.Errorf("not implemented")
				},
			}
			cmd := &datasources.AddDataSourceCommand{
				OrgID:      1,
				Type:       "test", // required to validate apiserver
				Name:       "test",
				APIVersion: "v123", // invalid apiVersion
			}
			_, err := dsService.AddDataSource(context.Background(), cmd)
			assert.ErrorContains(t, err, "expected apiVersion: v0alpha1, found: v123")
		})

		t.Run("should mutate a request", func(t *testing.T) {
			dsService := initDSService(t)
			dsService.pluginStore = &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{{
					JSONData: plugins.JSONData{
						ID:   "test",
						Type: plugins.TypeDataSource,
						Name: "test",
					},
				}},
			}
			dsService.pluginClient = &pluginfakes.FakePluginClient{
				ValidateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
					return &backend.ValidationResponse{
						Allowed: true,
					}, nil
				},
				MutateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
					settings, err := backend.DataSourceInstanceSettingsFromProto(req.ObjectBytes, "")
					if err != nil {
						return nil, err
					}
					settings.URL = "url-mutated"
					pb, err := backend.DataSourceInstanceSettingsToProtoBytes(settings)
					return &backend.MutationResponse{
						Allowed:     true,
						ObjectBytes: pb,
					}, err
				},
			}
			cmd := &datasources.AddDataSourceCommand{
				OrgID:      1,
				Type:       "test", // required to validate apiserver
				Name:       "test",
				APIVersion: "v0alpha1",
			}
			ds, err := dsService.AddDataSource(context.Background(), cmd)
			require.NoError(t, err)
			require.Equal(t, "url-mutated", ds.URL)
		})
	})
}

func TestService_getAvailableName(t *testing.T) {
	type testCase struct {
		desc       string
		dsType     string
		existingDs []*datasources.DataSource
		expected   string
	}

	testCases := []testCase{
		{
			desc:     "should return type as the name if no DS are passed in",
			dsType:   "prometheus",
			expected: "prometheus",
		},
		{
			desc:   "should return type as the name if no DS with that name exists",
			dsType: "prometheus",
			existingDs: []*datasources.DataSource{
				{Name: "graphite"},
				{Name: "loki"},
			},
			expected: "prometheus",
		},
		{
			desc:   "should return type-1 as the name if one data source with that name exists",
			dsType: "prometheus",
			existingDs: []*datasources.DataSource{
				{Name: "graphite"},
				{Name: "prometheus"},
			},
			expected: "prometheus-1",
		},
		{
			desc:   "should correctly increment the number suffix of the name",
			dsType: "prometheus",
			existingDs: []*datasources.DataSource{
				{Name: "prometheus"},
				{Name: "prometheus-1"},
				{Name: "prometheus-3"},
			},
			expected: "prometheus-2",
		},
		{
			desc:   "should correctly increment the number suffix for multidigit numbers",
			dsType: "prometheus",
			existingDs: []*datasources.DataSource{
				{Name: "prometheus"},
				{Name: "prometheus-1"},
				{Name: "prometheus-2"},
				{Name: "prometheus-3"},
				{Name: "prometheus-4"},
				{Name: "prometheus-5"},
				{Name: "prometheus-6"},
				{Name: "prometheus-7"},
				{Name: "prometheus-8"},
				{Name: "prometheus-9"},
				{Name: "prometheus-10"},
			},
			expected: "prometheus-11",
		},
		{
			desc:   "name comparison should be case insensitive",
			dsType: "prometheus",
			existingDs: []*datasources.DataSource{
				{Name: "Prometheus"},
				{Name: "PROMETHEUS"},
			},
			expected: "prometheus-1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			name := getAvailableName(tc.dsType, tc.existingDs)
			assert.Equal(t, tc.expected, name)
		})
	}
}

func TestService_UpdateDataSource(t *testing.T) {
	t.Run("should return not found error if datasource not found", func(t *testing.T) {
		dsService := initDSService(t)

		cmd := &datasources.UpdateDataSourceCommand{
			UID:   uuid.New().String(),
			ID:    1,
			OrgID: 1,
		}

		_, err := dsService.UpdateDataSource(context.Background(), cmd)
		require.ErrorIs(t, err, datasources.ErrDataSourceNotFound)
	})

	t.Run("should return validation error if command validation failed", func(t *testing.T) {
		dsService := initDSService(t)

		// First add the datasource
		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:  1,
			Name:   "test",
			Type:   "test",
			UserID: 0,
		})
		require.NoError(t, err)

		cmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			UID:   ds.UID,
			OrgID: 1,
			Name:  string(make([]byte, 256)),
		}

		_, err = dsService.UpdateDataSource(context.Background(), cmd)
		require.EqualError(t, err, "[datasource.nameInvalid] max length is 190")

		cmd = &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			UID:   ds.UID,
			OrgID: 1,
			URL:   string(make([]byte, 256)),
		}

		_, err = dsService.UpdateDataSource(context.Background(), cmd)
		require.EqualError(t, err, "[datasource.urlInvalid] max length is 255")
	})

	t.Run("should return no error if updated datasource", func(t *testing.T) {
		dsService := initDSService(t)

		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID: 1,
			Name:  "test-datasource",
		})
		require.NoError(t, err)

		cmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			OrgID: ds.OrgID,
			Name:  "test-datasource-updated",
		}

		_, err = dsService.UpdateDataSource(context.Background(), cmd)
		require.NoError(t, err)
	})

	t.Run("should return error if datasource with same name exist", func(t *testing.T) {
		dsService := initDSService(t)

		dsToUpdate, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID: 1,
			Name:  "test-datasource",
		})
		require.NoError(t, err)

		existingDs, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID: 1,
			Name:  "name already taken",
		})
		require.NoError(t, err)

		cmd := &datasources.UpdateDataSourceCommand{
			ID:    dsToUpdate.ID,
			OrgID: dsToUpdate.OrgID,
			Name:  existingDs.Name,
		}

		_, err = dsService.UpdateDataSource(context.Background(), cmd)
		require.ErrorIs(t, err, datasources.ErrDataSourceNameExists)
	})

	t.Run("should merge cmd.SecureJsonData with db data", func(t *testing.T) {
		dsService := initDSService(t)

		expectedDbKey := "db-secure-key"
		expectedDbValue := "db-secure-value"
		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID: 1,
			Name:  "test-datasource",
			SecureJsonData: map[string]string{
				expectedDbKey: expectedDbValue,
			},
		})
		require.NoError(t, err)

		expectedOgKey := "cmd-secure-key"
		expectedOgValue := "cmd-secure-value"

		cmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			OrgID: ds.OrgID,
			Name:  "test-datasource-updated",
			SecureJsonData: map[string]string{
				expectedOgKey: expectedOgValue,
			},
		}

		ds, err = dsService.UpdateDataSource(context.Background(), cmd)
		require.NoError(t, err)

		secret, err := dsService.DecryptedValues(context.Background(), ds)
		require.NoError(t, err)

		assert.Equal(t, secret[expectedDbKey], expectedDbValue)
		assert.Equal(t, secret[expectedOgKey], expectedOgValue)
	})

	t.Run("should preserve cmd.SecureJsonData when cmd.IgnoreOldSecureJsonData=true", func(t *testing.T) {
		dsService := initDSService(t)

		notExpectedDbKey := "db-secure-key"
		dbValue := "db-secure-value"
		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID: 1,
			Name:  "test-datasource",
			SecureJsonData: map[string]string{
				notExpectedDbKey: dbValue,
			},
		})
		require.NoError(t, err)

		expectedOgKey := "cmd-secure-key"
		expectedOgValue := "cmd-secure-value"

		cmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			OrgID: ds.OrgID,
			Name:  "test-datasource-updated",
			SecureJsonData: map[string]string{
				expectedOgKey: expectedOgValue,
			},
			IgnoreOldSecureJsonData: true,
		}

		ds, err = dsService.UpdateDataSource(context.Background(), cmd)
		require.NoError(t, err)

		secret, err := dsService.DecryptedValues(context.Background(), ds)
		require.NoError(t, err)

		assert.Equal(t, secret[expectedOgKey], expectedOgValue)
		_, ok := secret[notExpectedDbKey]
		assert.False(t, ok)
	})

	t.Run("should run validation and mutation hooks", func(t *testing.T) {
		dsService := initDSService(t)
		dsService.pluginStore = &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{{
				JSONData: plugins.JSONData{
					ID:   "test",
					Type: plugins.TypeDataSource,
					Name: "test",
				},
			}},
		}
		validateExecuted := false
		mutateExecuted := false
		dsService.pluginClient = &pluginfakes.FakePluginClient{
			ValidateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
				validateExecuted = true
				return &backend.ValidationResponse{
					Allowed: true,
				}, nil
			},
			MutateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
				mutateExecuted = true
				return &backend.MutationResponse{
					Allowed:     true,
					ObjectBytes: req.ObjectBytes,
				}, nil
			},
		}
		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:      1,
			Name:       "test-datasource",
			APIVersion: "v0alpha1",
			Type:       "test",
		})
		require.NoError(t, err)

		cmd := &datasources.UpdateDataSourceCommand{
			ID:         ds.ID,
			OrgID:      ds.OrgID,
			Name:       "test-datasource-updated",
			APIVersion: "v0alpha1",
			Type:       "test",
		}

		dsUpdated, err := dsService.UpdateDataSource(context.Background(), cmd)
		require.NoError(t, err)
		require.True(t, validateExecuted)
		require.True(t, mutateExecuted)
		require.Equal(t, "test-datasource-updated", dsUpdated.Name)
	})

	t.Run("Should update LBAC rules when updating from API", func(t *testing.T) {
		dsService := initDSService(t)
		dsService.features = featuremgmt.WithFeatures(featuremgmt.FlagTeamHttpHeaders)

		// Create a datasource with existing LBAC rules
		existingRules := []interface{}{
			map[string]interface{}{
				"name":  "X-Grafana-Team",
				"value": "team1",
			},
		}
		jsonData := simplejson.NewFromAny(map[string]interface{}{
			"teamHttpHeaders": existingRules,
		})

		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:    1,
			Name:     "test-datasource",
			Type:     "prometheus",
			JsonData: jsonData,
		})
		require.NoError(t, err)
		// Verify that the datasource was created with the correct JsonData
		createdDS, err := dsService.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{
			OrgID: ds.OrgID,
			ID:    ds.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, createdDS.JsonData)
		createdRules := createdDS.JsonData.Get("teamHttpHeaders").MustArray()
		require.Equal(t, existingRules, createdRules)

		// Update the datasource with new LBAC rules from API
		newRules := []interface{}{
			map[string]interface{}{
				"name":  "X-Grafana-Team",
				"value": "team2",
			},
		}
		updateCmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			OrgID: ds.OrgID,
			Name:  "updated-datasource",
			Type:  "prometheus",
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"teamHttpHeaders": newRules,
			}),
			AllowLBACRuleUpdates: true,
		}

		updatedDS, err := dsService.UpdateDataSource(context.Background(), updateCmd)
		require.NoError(t, err)

		// Check if the LBAC rules are updated
		updatedRules := updatedDS.JsonData.Get("teamHttpHeaders").MustArray()
		require.Equal(t, newRules, updatedRules)
	})
	t.Run("Should preserve LBAC rules when not updating from API", func(t *testing.T) {
		dsService := initDSService(t)
		dsService.features = featuremgmt.WithFeatures(featuremgmt.FlagTeamHttpHeaders)
		// Create a datasource with existing LBAC rules
		existingRules := []interface{}{
			map[string]interface{}{
				"name":  "X-Grafana-Team",
				"value": "team1",
			},
		}
		jsonData := simplejson.NewFromAny(map[string]interface{}{
			"teamHttpHeaders": existingRules,
		})

		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:    1,
			Name:     "test-datasource",
			Type:     "prometheus",
			JsonData: jsonData,
		})
		require.NoError(t, err)
		// Verify that the datasource was created with the correct JsonData
		createdDS, err := dsService.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{
			OrgID: ds.OrgID,
			ID:    ds.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, createdDS.JsonData)
		createdRules := createdDS.JsonData.Get("teamHttpHeaders").MustArray()
		require.Equal(t, existingRules, createdRules)

		// Update the datasource without LBAC rules in the command
		updateCmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			OrgID: ds.OrgID,
			Name:  "updated-datasource",
			Type:  "prometheus",
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"someOtherSetting": "value",
			}),
			AllowLBACRuleUpdates: false,
		}

		updatedDS, err := dsService.UpdateDataSource(context.Background(), updateCmd)
		require.NoError(t, err)

		// Check if the LBAC rules are preserved
		updatedRules := updatedDS.JsonData.Get("teamHttpHeaders").MustArray()
		require.Equal(t, existingRules, updatedRules)
	})

	t.Run("Should not remove stored rules without AllowLBACRuleUpdates", func(t *testing.T) {
		dsService := initDSService(t)
		dsService.features = featuremgmt.WithFeatures(featuremgmt.FlagTeamHttpHeaders)

		// Create a datasource with existing LBAC rules
		existingRules := []interface{}{
			map[string]interface{}{
				"name":  "X-Grafana-Team",
				"value": "team1",
			},
		}
		jsonData := simplejson.NewFromAny(map[string]interface{}{
			"teamHttpHeaders": existingRules,
		})

		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:    1,
			Name:     "test-datasource",
			Type:     "prometheus",
			JsonData: jsonData,
		})
		require.NoError(t, err)

		// Update the datasource without any LBAC rules in the command
		updateCmd := &datasources.UpdateDataSourceCommand{
			ID:                   ds.ID,
			OrgID:                ds.OrgID,
			Name:                 "updated-datasource",
			Type:                 "prometheus",
			AllowLBACRuleUpdates: false,
		}

		updatedDS, err := dsService.UpdateDataSource(context.Background(), updateCmd)
		require.NoError(t, err)

		// Check if the LBAC rules are preserved
		updatedRules := updatedDS.JsonData.Get("teamHttpHeaders").MustArray()
		require.Equal(t, existingRules, updatedRules)
	})

	t.Run("Should not populate empty stored rules without AllowLBACRuleUpdates", func(t *testing.T) {
		dsService := initDSService(t)
		dsService.features = featuremgmt.WithFeatures(featuremgmt.FlagTeamHttpHeaders)

		// Create a datasource with empty LBAC rules
		jsonData := simplejson.New()

		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:    1,
			Name:     "test-datasource",
			Type:     "prometheus",
			JsonData: jsonData,
		})
		require.NoError(t, err)

		// Update the datasource with new LBAC rules but without AllowLBACRuleUpdates
		newRules := []interface{}{
			map[string]interface{}{
				"name":  "X-Grafana-Team",
				"value": "team2",
			},
		}
		updateCmd := &datasources.UpdateDataSourceCommand{
			ID:    ds.ID,
			OrgID: ds.OrgID,
			Name:  "updated-datasource",
			Type:  "prometheus",
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"teamHttpHeaders": newRules,
			}),
			AllowLBACRuleUpdates: false,
		}

		updatedDS, err := dsService.UpdateDataSource(context.Background(), updateCmd)
		require.NoError(t, err)

		// Check if the LBAC rules are still empty
		updatedRules, ok := updatedDS.JsonData.CheckGet("teamHttpHeaders")
		require.False(t, ok)
		require.Nil(t, updatedRules)
	})
}

func TestService_DeleteDataSource(t *testing.T) {
	t.Run("should not return an error if data source doesn't exist", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		permissionSvc := acmock.NewMockedPermissionsService()
		permissionSvc.On("DeleteResourcePermissions", mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()

		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, &setting.Cfg{}, featuremgmt.WithFeatures(), acmock.New(), permissionSvc, quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		cmd := &datasources.DeleteDataSourceCommand{
			UID:   uuid.New().String(),
			ID:    1,
			OrgID: 1,
		}

		err = dsService.DeleteDataSource(context.Background(), cmd)
		require.NoError(t, err)
	})

	t.Run("should successfully delete a data source that exists", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)

		permissionSvc := acmock.NewMockedPermissionsService()
		permissionSvc.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil).Once()
		permissionSvc.On("DeleteResourcePermissions", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		cfg := &setting.Cfg{}
		enableRBACManagedPermissions(t, cfg)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), permissionSvc, quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		// First add the datasource
		ds, err := dsService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:  1,
			Name:   "test",
			Type:   "test",
			UserID: 0,
		})
		require.NoError(t, err)

		cmd := &datasources.DeleteDataSourceCommand{
			ID:    ds.ID,
			UID:   ds.UID,
			OrgID: 1,
		}

		err = dsService.DeleteDataSource(context.Background(), cmd)
		require.NoError(t, err)

		// Data source doesn't exist anymore
		ds, err = dsService.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{
			OrgID: 1,
			UID:   ds.UID,
		})
		require.Nil(t, ds)
		require.ErrorIs(t, err, datasources.ErrDataSourceNotFound)

		permissionSvc.AssertExpectations(t)
	})
}

func TestService_NameScopeResolver(t *testing.T) {
	retriever := &dataSourceMockRetriever{[]*datasources.DataSource{
		{Name: "test-datasource", UID: "1"},
		{Name: "*", UID: "2"},
		{Name: ":/*", UID: "3"},
		{Name: ":", UID: "4"},
	}}

	type testCaseResolver struct {
		desc    string
		given   string
		want    string
		wantErr error
	}

	testCases := []testCaseResolver{
		{
			desc:    "correct",
			given:   "datasources:name:test-datasource",
			want:    "datasources:uid:1",
			wantErr: nil,
		},
		{
			desc:    "asterisk in name",
			given:   "datasources:name:*",
			want:    "datasources:uid:2",
			wantErr: nil,
		},
		{
			desc:    "complex name",
			given:   "datasources:name::/*",
			want:    "datasources:uid:3",
			wantErr: nil,
		},
		{
			desc:    "colon in name",
			given:   "datasources:name::",
			want:    "datasources:uid:4",
			wantErr: nil,
		},
		{
			desc:    "unknown datasource",
			given:   "datasources:name:unknown-datasource",
			want:    "",
			wantErr: datasources.ErrDataSourceNotFound,
		},
		{
			desc:    "malformed scope",
			given:   "datasources:unknown-datasource",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
		{
			desc:    "empty name scope",
			given:   "datasources:name:",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
	}
	prefix, resolver := NewNameScopeResolver(retriever)
	require.Equal(t, "datasources:name:", prefix)

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resolved, err := resolver.Resolve(context.Background(), 1, tc.given)
			if tc.wantErr != nil {
				require.Error(t, err)
				require.Equal(t, tc.wantErr, err)
			} else {
				require.NoError(t, err)
				require.Len(t, resolved, 1)
				require.Equal(t, tc.want, resolved[0])
			}
		})
	}
}

func TestService_IDScopeResolver(t *testing.T) {
	retriever := &dataSourceMockRetriever{[]*datasources.DataSource{
		{ID: 1, UID: "NnftN9Lnz"},
	}}

	type testCaseResolver struct {
		desc    string
		given   string
		want    string
		wantErr error
	}

	testCases := []testCaseResolver{
		{
			desc:    "correct",
			given:   "datasources:id:1",
			want:    "datasources:uid:NnftN9Lnz",
			wantErr: nil,
		},
		{
			desc:    "unknown datasource",
			given:   "datasources:id:unknown",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
		{
			desc:    "malformed scope",
			given:   "datasources:unknown",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
		{
			desc:    "empty uid scope",
			given:   "datasources:id:",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
	}
	prefix, resolver := NewIDScopeResolver(retriever)
	require.Equal(t, "datasources:id:", prefix)

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resolved, err := resolver.Resolve(context.Background(), 1, tc.given)
			if tc.wantErr != nil {
				require.Error(t, err)
				require.Equal(t, tc.wantErr, err)
			} else {
				require.NoError(t, err)
				require.Len(t, resolved, 1)
				require.Equal(t, tc.want, resolved[0])
			}
		})
	}
}

func TestService_awsServiceNamespace(t *testing.T) {
	type testCaseResolver struct {
		desc      string
		givenDs   string
		givenJson string
		want      string
		panic     bool
	}

	testCases := []testCaseResolver{
		{
			desc:      "elasticsearch",
			givenDs:   datasources.DS_ES,
			givenJson: `{ "sigV4Auth": true, "serverless": true }`,
			want:      "es",
		}, {
			desc:      "opendistro",
			givenDs:   datasources.DS_ES_OPEN_DISTRO,
			givenJson: `{ "sigV4Auth": true, "serverless": true }`,
			want:      "es",
		}, {
			desc:      "opensearch not serverless",
			givenDs:   datasources.DS_ES_OPENSEARCH,
			givenJson: `{ "sigV4Auth": true }`,
			want:      "es",
		}, {
			desc:      "opensearch not serverless",
			givenDs:   datasources.DS_ES_OPENSEARCH,
			givenJson: `{ "sigV4Auth": true, "serverless": false }`,
			want:      "es",
		}, {
			desc:      "opensearch serverless",
			givenDs:   datasources.DS_ES_OPENSEARCH,
			givenJson: `{ "sigV4Auth": true, "serverless": true }`,
			want:      "aoss",
		}, {
			desc:      "prometheus",
			givenDs:   datasources.DS_PROMETHEUS,
			givenJson: `{ "sigV4Auth": true, "serverless": true }`,
			want:      "aps",
		}, {
			desc:      "alertmanager",
			givenDs:   datasources.DS_ALERTMANAGER,
			givenJson: `{ "sigV4Auth": true, "serverless": true }`,
			want:      "aps",
		}, {
			desc:      "panic",
			givenDs:   "panic",
			givenJson: `{ "sigV4Auth": true, "serverless": true }`,
			want:      "aps",
			panic:     true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			json, _ := simplejson.NewJson([]byte(tc.givenJson))
			if tc.panic {
				require.Panics(t, func() { awsServiceNamespace(tc.givenDs, json) })
			} else {
				resolved := awsServiceNamespace(tc.givenDs, json)
				require.Equal(t, tc.want, resolved)
			}
		})
	}
}

//nolint:goconst
func TestService_GetHttpTransport(t *testing.T) {
	cfg := &setting.Cfg{}

	t.Run("Should use cached proxy", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})

		ds := datasources.DataSource{
			ID:   1,
			URL:  "http://k8s:8001",
			Type: "Kubernetes",
		}

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		rt1, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt1)
		tr1 := configuredTransport

		rt2, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt2)
		tr2 := configuredTransport

		require.Same(t, tr1, tr2)

		require.False(t, tr1.TLSClientConfig.InsecureSkipVerify)
		require.Empty(t, tr1.TLSClientConfig.Certificates)
		require.Nil(t, tr1.TLSClientConfig.RootCAs)
	})

	t.Run("Should not use cached proxy when datasource updated", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})

		cfg.SecretKey = "password"

		sjson := simplejson.New()
		sjson.Set("tlsAuthWithCACert", true)

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			ID:             1,
			URL:            "http://k8s:8001",
			Type:           "Kubernetes",
			SecureJsonData: map[string][]byte{"tlsCACert": []byte(caCert)},
			Updated:        time.Now().Add(-2 * time.Minute),
		}

		rt1, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NotNil(t, rt1)
		require.NoError(t, err)

		tr1 := configuredTransport

		require.False(t, tr1.TLSClientConfig.InsecureSkipVerify)
		require.Empty(t, tr1.TLSClientConfig.Certificates)
		require.Nil(t, tr1.TLSClientConfig.RootCAs)

		ds.JsonData = nil
		ds.SecureJsonData = map[string][]byte{}
		ds.Updated = time.Now()

		rt2, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt2)
		tr2 := configuredTransport

		require.NotSame(t, tr1, tr2)
		require.Nil(t, tr2.TLSClientConfig.RootCAs)
	})

	t.Run("Should set TLS client authentication enabled if configured in JsonData", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})

		cfg.SecretKey = "password"

		sjson := simplejson.New()
		sjson.Set("tlsAuth", true)

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			ID:       1,
			OrgID:    1,
			Name:     "kubernetes",
			URL:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: sjson,
		}

		secureJsonData, err := json.Marshal(map[string]string{
			"tlsClientCert": clientCert,
			"tlsClientKey":  clientKey,
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), ds.OrgID, ds.Name, secretskvs.DataSourceSecretType, string(secureJsonData))
		require.NoError(t, err)

		rt, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt)
		tr := configuredTransport

		require.False(t, tr.TLSClientConfig.InsecureSkipVerify)
		require.Len(t, tr.TLSClientConfig.Certificates, 1)
	})

	t.Run("Should set user-supplied TLS CA if configured in JsonData", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})

		cfg.SecretKey = "password"

		sjson := simplejson.New()
		sjson.Set("tlsAuthWithCACert", true)
		sjson.Set("serverName", "server-name")

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			ID:       1,
			OrgID:    1,
			Name:     "kubernetes",
			URL:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: sjson,
		}

		secureJsonData, err := json.Marshal(map[string]string{
			"tlsCACert": caCert,
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), ds.OrgID, ds.Name, secretskvs.DataSourceSecretType, string(secureJsonData))
		require.NoError(t, err)

		rt, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt)
		tr := configuredTransport

		opts, err := dsService.httpClientOptions(context.Background(), &ds)
		require.NoError(t, err)
		require.Equal(t, ds.JsonData.MustMap()["grafanaData"], opts.CustomOptions["grafanaData"])

		// make sure we can still marshal the JsonData after httpClientOptions (avoid cycles)
		_, err = ds.JsonData.MarshalJSON()
		require.NoError(t, err)

		require.False(t, tr.TLSClientConfig.InsecureSkipVerify)
		// Ignoring deprecation, the system will not include the root CA
		// used in this scenario.
		//nolint:staticcheck
		require.Len(t, tr.TLSClientConfig.RootCAs.Subjects(), 1)
		require.Equal(t, "server-name", tr.TLSClientConfig.ServerName)
	})

	t.Run("Should set skip TLS verification if configured in JsonData", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})

		sjson := simplejson.New()
		sjson.Set("tlsSkipVerify", true)

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			ID:       1,
			URL:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: sjson,
		}

		rt1, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt1)
		tr1 := configuredTransport

		rt2, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt2)
		tr2 := configuredTransport

		require.Same(t, tr1, tr2)
		require.True(t, tr1.TLSClientConfig.InsecureSkipVerify)
	})

	t.Run("Should set custom headers if configured in JsonData", func(t *testing.T) {
		provider := httpclient.NewProvider()

		sjson := simplejson.NewFromAny(map[string]any{
			"httpHeaderName1": "Authorization",
		})

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			ID:       1,
			OrgID:    1,
			Name:     "kubernetes",
			URL:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: sjson,
		}

		secureJsonData, err := json.Marshal(map[string]string{
			"httpHeaderValue1": "Bearer xf5yhfkpsnmgo",
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), ds.OrgID, ds.Name, secretskvs.DataSourceSecretType, string(secureJsonData))
		require.NoError(t, err)

		headers := dsService.getCustomHeaders(sjson, map[string]string{"httpHeaderValue1": "Bearer xf5yhfkpsnmgo"})
		require.Equal(t, "Bearer xf5yhfkpsnmgo", headers.Get("Authorization"))

		// 1. Start HTTP test server which checks the request headers
		backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") == "Bearer xf5yhfkpsnmgo" {
				w.WriteHeader(200)
				_, err := w.Write([]byte("Ok"))
				require.NoError(t, err)
				return
			}

			w.WriteHeader(403)
			_, err := w.Write([]byte("Invalid bearer token provided"))
			require.NoError(t, err)
		}))
		defer backend.Close()

		// 2. Get HTTP transport from datasource which uses the test server as backend
		ds.URL = backend.URL
		rt, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt)

		// 3. Send test request which should have the Authorization header set
		req := httptest.NewRequest("GET", backend.URL+"/test-headers", nil)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := res.Body.Close()
			require.NoError(t, err)
		})
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		bodyStr := string(body)
		require.Equal(t, "Ok", bodyStr)
	})

	t.Run("Should set request Host if it is configured in custom headers within JsonData", func(t *testing.T) {
		provider := httpclient.NewProvider()

		sjson := simplejson.NewFromAny(map[string]any{
			"httpHeaderName1": "Host",
		})

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			ID:       1,
			OrgID:    1,
			Name:     "kubernetes",
			URL:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: sjson,
		}

		secureJsonData, err := json.Marshal(map[string]string{
			"httpHeaderValue1": "example.com",
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), ds.OrgID, ds.Name, secretskvs.DataSourceSecretType, string(secureJsonData))
		require.NoError(t, err)

		headers := dsService.getCustomHeaders(sjson, map[string]string{"httpHeaderValue1": "example.com"})
		require.Equal(t, "example.com", headers.Get("Host"))

		// 1. Start HTTP test server which checks the request headers
		backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Host == "example.com" {
				w.WriteHeader(200)
				_, err := w.Write([]byte("Ok"))
				require.NoError(t, err)
				return
			}

			w.WriteHeader(503)
			_, err := w.Write([]byte("Server name mismatch"))
			require.NoError(t, err)
		}))
		defer backend.Close()

		// 2. Get HTTP transport from datasource which uses the test server as backend
		ds.URL = backend.URL
		rt, err := dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, rt)

		// 3. Send test request which should have the Authorization header set
		req := httptest.NewRequest("GET", backend.URL+"/test-host", nil)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := res.Body.Close()
			require.NoError(t, err)
		})
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		bodyStr := string(body)
		require.Equal(t, "Ok", bodyStr)
	})

	t.Run("Should populate SigV4 options if configured in JsonData", func(t *testing.T) {
		var configuredOpts sdkhttpclient.Options
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredOpts = opts
			},
		})

		origSigV4Enabled := cfg.SigV4AuthEnabled
		cfg.SigV4AuthEnabled = true
		t.Cleanup(func() {
			cfg.SigV4AuthEnabled = origSigV4Enabled
		})

		sjson, err := simplejson.NewJson([]byte(`{ "sigV4Auth": true }`))
		require.NoError(t, err)

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		ds := datasources.DataSource{
			Type:     datasources.DS_ES,
			JsonData: sjson,
		}

		_, err = dsService.GetHTTPTransport(context.Background(), &ds, provider)
		require.NoError(t, err)
		require.NotNil(t, configuredOpts)
		require.NotNil(t, configuredOpts.SigV4)
		require.Equal(t, "es", configuredOpts.SigV4.Service)
	})
}

func TestService_getProxySettings(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	quotaService := quotatest.New(false, nil)
	dsService, err := ProvideService(sqlStore, secretsService, secretsStore, &setting.Cfg{}, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
	require.NoError(t, err)

	t.Run("Should default to disabled", func(t *testing.T) {
		ds := datasources.DataSource{
			ID:    1,
			OrgID: 1,
			UID:   "uid",
			Name:  "graphite",
			URL:   "http://test:8001",
			Type:  "Graphite",
		}

		opts, err := dsService.httpClientOptions(context.Background(), &ds)
		require.NoError(t, err)
		require.Nil(t, opts.ProxyOptions)
	})

	t.Run("Username should default to datasource UID", func(t *testing.T) {
		sjson := simplejson.New()
		sjson.Set("enableSecureSocksProxy", true)
		ds := datasources.DataSource{
			ID:       1,
			OrgID:    1,
			UID:      "uid",
			Name:     "graphite",
			URL:      "http://test:8001",
			Type:     "Graphite",
			JsonData: sjson,
		}

		opts, err := dsService.httpClientOptions(context.Background(), &ds)
		require.NoError(t, err)
		require.True(t, opts.ProxyOptions.Enabled)
		require.Equal(t, opts.ProxyOptions.Auth.Username, ds.UID)
	})

	t.Run("Can override options", func(t *testing.T) {
		sjson := simplejson.New()
		pass := "testpass"
		user := "testuser"
		sjson.Set("enableSecureSocksProxy", true)
		sjson.Set("secureSocksProxyUsername", user)
		sjson.Set("timeout", 10)
		sjson.Set("keepAlive", 5)
		ds := datasources.DataSource{
			ID:       1,
			OrgID:    1,
			UID:      "uid",
			Name:     "graphite",
			URL:      "http://test:8001",
			Type:     "Graphite",
			JsonData: sjson,
		}

		secureJsonData, err := json.Marshal(map[string]string{
			"secureSocksProxyPassword": pass,
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), ds.OrgID, ds.Name, secretskvs.DataSourceSecretType, string(secureJsonData))
		require.NoError(t, err)

		opts, err := dsService.httpClientOptions(context.Background(), &ds)
		require.NoError(t, err)
		require.True(t, opts.ProxyOptions.Enabled)
		require.Equal(t, opts.ProxyOptions.Auth.Username, user)
		require.Equal(t, opts.ProxyOptions.Auth.Password, pass)
		require.Equal(t, opts.ProxyOptions.Timeouts.Timeout, 10*time.Second)
		require.Equal(t, opts.ProxyOptions.Timeouts.KeepAlive, 5*time.Second)
	})
}

func TestService_getTimeout(t *testing.T) {
	cfg := &setting.Cfg{}
	originalTimeout := sdkhttpclient.DefaultTimeoutOptions.Timeout
	sdkhttpclient.DefaultTimeoutOptions.Timeout = time.Minute
	t.Cleanup(func() {
		sdkhttpclient.DefaultTimeoutOptions.Timeout = originalTimeout
	})

	testCases := []struct {
		jsonData        *simplejson.Json
		expectedTimeout time.Duration
	}{
		{jsonData: simplejson.New(), expectedTimeout: time.Minute},
		{jsonData: simplejson.NewFromAny(map[string]any{"timeout": nil}), expectedTimeout: time.Minute},
		{jsonData: simplejson.NewFromAny(map[string]any{"timeout": 0}), expectedTimeout: time.Minute},
		{jsonData: simplejson.NewFromAny(map[string]any{"timeout": 1}), expectedTimeout: time.Second},
		{jsonData: simplejson.NewFromAny(map[string]any{"timeout": "2"}), expectedTimeout: 2 * time.Second},
	}

	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	quotaService := quotatest.New(false, nil)
	dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
	require.NoError(t, err)

	for _, tc := range testCases {
		ds := &datasources.DataSource{
			JsonData: tc.jsonData,
		}
		assert.Equal(t, tc.expectedTimeout, dsService.getTimeout(ds))
	}
}

func TestService_GetDecryptedValues(t *testing.T) {
	t.Run("should migrate and retrieve values from secure json data", func(t *testing.T) {
		ds := &datasources.DataSource{
			ID:   1,
			URL:  "https://api.example.com",
			Type: "prometheus",
		}

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		jsonData := map[string]string{
			"password": "securePassword",
		}
		secureJsonData, err := dsService.SecretsService.EncryptJsonData(context.Background(), jsonData, secrets.WithoutScope())

		require.NoError(t, err)
		ds.SecureJsonData = secureJsonData

		values, err := dsService.DecryptedValues(context.Background(), ds)
		require.NoError(t, err)

		require.Equal(t, jsonData, values)
	})

	t.Run("should retrieve values from secret store", func(t *testing.T) {
		ds := &datasources.DataSource{
			ID:   1,
			URL:  "https://api.example.com",
			Type: "prometheus",
		}

		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		quotaService := quotatest.New(false, nil)
		dsService, err := ProvideService(sqlStore, secretsService, secretsStore, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
		require.NoError(t, err)

		jsonData := map[string]string{
			"password": "securePassword",
		}
		jsonString, err := json.Marshal(jsonData)
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), ds.OrgID, ds.Name, secretskvs.DataSourceSecretType, string(jsonString))
		require.NoError(t, err)

		values, err := dsService.DecryptedValues(context.Background(), ds)
		require.NoError(t, err)

		require.Equal(t, jsonData, values)
	})
}

func TestDataSource_CustomHeaders(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	quotaService := quotatest.New(false, nil)
	dsService, err := ProvideService(sqlStore, secretsService, secretsStore, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil)
	require.NoError(t, err)

	dsService.cfg = setting.NewCfg()

	testValue := "HeaderValue1"

	encryptedValue, err := secretsService.Encrypt(context.Background(), []byte(testValue), secrets.WithoutScope())
	require.NoError(t, err)

	testCases := []struct {
		name             string
		jsonData         *simplejson.Json
		secureJsonData   map[string][]byte
		expectedHeaders  http.Header
		expectedErrorMsg string
	}{
		{
			name: "valid custom headers",
			jsonData: simplejson.NewFromAny(map[string]any{
				"httpHeaderName1": "X-Test-Header1",
			}),
			secureJsonData: map[string][]byte{
				"httpHeaderValue1": encryptedValue,
			},
			expectedHeaders: http.Header{
				"X-Test-Header1": []string{testValue},
			},
		},
		{
			name: "missing header value",
			jsonData: simplejson.NewFromAny(map[string]any{
				"httpHeaderName1": "X-Test-Header1",
			}),
			secureJsonData:  map[string][]byte{},
			expectedHeaders: http.Header{},
		},
		{
			name: "non customer header value",
			jsonData: simplejson.NewFromAny(map[string]any{
				"someotherheader": "X-Test-Header1",
			}),
			secureJsonData:  map[string][]byte{},
			expectedHeaders: http.Header{},
		},
		{
			name: "add multiple header value",
			jsonData: simplejson.NewFromAny(map[string]any{
				"httpHeaderName1": "X-Test-Header1",
				"httpHeaderName2": "X-Test-Header1",
			}),
			secureJsonData: map[string][]byte{
				"httpHeaderValue1": encryptedValue,
				"httpHeaderValue2": encryptedValue,
			},
			expectedHeaders: http.Header{
				"X-Test-Header1": []string{testValue, testValue},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ds := &datasources.DataSource{
				JsonData:       tc.jsonData,
				SecureJsonData: tc.secureJsonData,
			}

			headers, err := dsService.CustomHeaders(context.Background(), ds)

			if tc.expectedErrorMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectedErrorMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.expectedHeaders, headers)
			}
		})
	}
}

func initDSService(t *testing.T) *Service {
	cfg := &setting.Cfg{}
	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	quotaService := quotatest.New(false, nil)
	mockPermission := acmock.NewMockedPermissionsService()
	mockPermission.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	dsService, err := ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), actest.FakeAccessControl{}, mockPermission, quotaService, &pluginstore.FakePluginStore{
		PluginList: []pluginstore.Plugin{{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.TypeDataSource,
				Name: "test",
			},
		}},
	}, &pluginfakes.FakePluginClient{
		ValidateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
			return &backend.ValidationResponse{
				Allowed: true,
			}, nil
		},
		MutateAdmissionFunc: func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
			return &backend.MutationResponse{
				Allowed:     true,
				ObjectBytes: req.ObjectBytes,
			}, nil
		},
	}, plugincontext.ProvideBaseService(cfg, pluginconfig.NewFakePluginRequestConfigProvider()))
	require.NoError(t, err)

	return dsService
}

func enableRBACManagedPermissions(t testing.TB, cfg *setting.Cfg) {
	t.Helper()
	f := ini.Empty()
	f.Section("rbac").Key("resources_with_managed_permissions_on_creation").SetValue("datasource")
	tempCfg, err := setting.NewCfgFromINIFile(f)
	cfg.RBAC = tempCfg.RBAC
	require.NoError(t, err)
}

const caCert string = `-----BEGIN CERTIFICATE-----
MIIDATCCAemgAwIBAgIJAMQ5hC3CPDTeMA0GCSqGSIb3DQEBCwUAMBcxFTATBgNV
BAMMDGNhLWs4cy1zdGhsbTAeFw0xNjEwMjcwODQyMjdaFw00NDAzMTQwODQyMjda
MBcxFTATBgNVBAMMDGNhLWs4cy1zdGhsbTCCASIwDQYJKoZIhvcNAQEBBQADggEP
ADCCAQoCggEBAMLe2AmJ6IleeUt69vgNchOjjmxIIxz5sp1vFu94m1vUip7CqnOg
QkpUsHeBPrGYv8UGloARCL1xEWS+9FVZeXWQoDmbC0SxXhFwRIESNCET7Q8KMi/4
4YPvnMLGZi3Fjwxa8BdUBCN1cx4WEooMVTWXm7RFMtZgDfuOAn3TNXla732sfT/d
1HNFrh48b0wA+HhmA3nXoBnBEblA665hCeo7lIAdRr0zJxJpnFnWXkyTClsAUTMN
iL905LdBiiIRenojipfKXvMz88XSaWTI7JjZYU3BvhyXndkT6f12cef3I96NY3WJ
0uIK4k04WrbzdYXMU3rN6NqlvbHqnI+E7aMCAwEAAaNQME4wHQYDVR0OBBYEFHHx
2+vSPw9bECHj3O51KNo5VdWOMB8GA1UdIwQYMBaAFHHx2+vSPw9bECHj3O51KNo5
VdWOMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAH2eV5NcV3LBJHs9
I+adbiTPg2vyumrGWwy73T0X8Dtchgt8wU7Q9b9Ucg2fOTmSSyS0iMqEu1Yb2ORB
CknM9mixHC9PwEBbkGCom3VVkqdLwSP6gdILZgyLoH4i8sTUz+S1yGPepi+Vzhs7
adOXtryjcGnwft6HdfKPNklMOHFnjw6uqpho54oj/z55jUpicY/8glDHdrr1bh3k
MHuiWLGewHXPvxfG6UoUx1te65IhifVcJGFZDQwfEmhBflfCmtAJlZEsgTLlBBCh
FHoXIyGOdq1chmRVocdGBCF8fUoGIbuF14r53rpvcbEKtKnnP8+96luKAZLq0a4n
3lb92xM=
-----END CERTIFICATE-----`

const clientCert string = `
-----BEGIN CERTIFICATE-----
MIICsjCCAZoCCQCcd8sOfstQLzANBgkqhkiG9w0BAQsFADAXMRUwEwYDVQQDDAxj
YS1rOHMtc3RobG0wHhcNMTYxMTAyMDkyNTE1WhcNMTcxMTAyMDkyNTE1WjAfMR0w
GwYDVQQDDBRhZG0tZGFuaWVsLWs4cy1zdGhsbTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAOMliaWyNEUJKM37vWCl5bGub3lMicyRAqGQyY/qxD9yKKM2
FbucVcmWmg5vvTqQVl5rlQ+c7GI8OD6ptmFl8a26coEki7bFr8bkpSyBSEc5p27b
Z0ORFSqBHWHQbr9PkxPLYW6T3gZYUtRYv3OQgGxLXlvUh85n/mQfuR3N1FgmShHo
GtAFi/ht6leXa0Ms+jNSDLCmXpJm1GIEqgyKX7K3+g3vzo9coYqXq4XTa8Efs2v8
SCwqWfBC3rHfgs/5DLB8WT4Kul8QzxkytzcaBQfRfzhSV6bkgm7oTzt2/1eRRsf4
YnXzLE9YkCC9sAn+Owzqf+TYC1KRluWDfqqBTJUCAwEAATANBgkqhkiG9w0BAQsF
AAOCAQEAdMsZg6edWGC+xngizn0uamrUg1ViaDqUsz0vpzY5NWLA4MsBc4EtxWRP
ueQvjUimZ3U3+AX0YWNLIrH1FCVos2jdij/xkTUmHcwzr8rQy+B17cFi+a8jtpgw
AU6WWoaAIEhhbWQfth/Diz3mivl1ARB+YqiWca2mjRPLTPcKJEURDVddQ423el0Q
4JNxS5icu7T2zYTYHAo/cT9zVdLZl0xuLxYm3asK1IONJ/evxyVZima3il6MPvhe
58Hwz+m+HdqHxi24b/1J/VKYbISG4huOQCdLzeNXgvwFlGPUmHSnnKo1/KbQDAR5
llG/Sw5+FquFuChaA6l5KWy7F3bQyA==
-----END CERTIFICATE-----`

// #nosec G101
const clientKey string = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA4yWJpbI0RQkozfu9YKXlsa5veUyJzJECoZDJj+rEP3IoozYV
u5xVyZaaDm+9OpBWXmuVD5zsYjw4Pqm2YWXxrbpygSSLtsWvxuSlLIFIRzmnbttn
Q5EVKoEdYdBuv0+TE8thbpPeBlhS1Fi/c5CAbEteW9SHzmf+ZB+5Hc3UWCZKEega
0AWL+G3qV5drQyz6M1IMsKZekmbUYgSqDIpfsrf6De/Oj1yhiperhdNrwR+za/xI
LCpZ8ELesd+Cz/kMsHxZPgq6XxDPGTK3NxoFB9F/OFJXpuSCbuhPO3b/V5FGx/hi
dfMsT1iQIL2wCf47DOp/5NgLUpGW5YN+qoFMlQIDAQABAoIBAQCzy4u312XeW1Cs
Mx6EuOwmh59/ESFmBkZh4rxZKYgrfE5EWlQ7i5SwG4BX+wR6rbNfy6JSmHDXlTkk
CKvvToVNcW6fYHEivDnVojhIERFIJ4+rhQmpBtcNLOQ3/4cZ8X/GxE6b+3lb5l+x
64mnjPLKRaIr5/+TVuebEy0xNTJmjnJ7yiB2HRz7uXEQaVSk/P7KAkkyl/9J3/LM
8N9AX1w6qDaNQZ4/P0++1H4SQenosM/b/GqGTomarEk/GE0NcB9rzmR9VCXa7FRh
WV5jyt9vUrwIEiK/6nUnOkGO8Ei3kB7Y+e+2m6WdaNoU5RAfqXmXa0Q/a0lLRruf
vTMo2WrBAoGBAPRaK4cx76Q+3SJ/wfznaPsMM06OSR8A3ctKdV+ip/lyKtb1W8Pz
k8MYQDH7GwPtSu5QD8doL00pPjugZL/ba7X9nAsI+pinyEErfnB9y7ORNEjIYYzs
DiqDKup7ANgw1gZvznWvb9Ge0WUSXvWS0pFkgootQAf+RmnnbWGH6l6RAoGBAO35
aGUrLro5u9RD24uSXNU3NmojINIQFK5dHAT3yl0BBYstL43AEsye9lX95uMPTvOQ
Cqcn42Hjp/bSe3n0ObyOZeXVrWcDFAfE0wwB1BkvL1lpgnFO9+VQORlH4w3Ppnpo
jcPkR2TFeDaAYtvckhxe/Bk3OnuFmnsQ3VzM75fFAoGBAI6PvS2XeNU+yA3EtA01
hg5SQ+zlHswz2TMuMeSmJZJnhY78f5mHlwIQOAPxGQXlf/4iP9J7en1uPpzTK3S0
M9duK4hUqMA/w5oiIhbHjf0qDnMYVbG+V1V+SZ+cPBXmCDihKreGr5qBKnHpkfV8
v9WL6o1rcRw4wiQvnaV1gsvBAoGBALtzVTczr6gDKCAIn5wuWy+cQSGTsBunjRLX
xuVm5iEiV+KMYkPvAx/pKzMLP96lRVR3ptyKgAKwl7LFk3u50+zh4gQLr35QH2wL
Lw7rNc3srAhrItPsFzqrWX6/cGuFoKYVS239l/sZzRppQPXcpb7xVvTp2whHcir0
Wtnpl+TdAoGAGqKqo2KU3JoY3IuTDUk1dsNAm8jd9EWDh+s1x4aG4N79mwcss5GD
FF8MbFPneK7xQd8L6HisKUDAUi2NOyynM81LAftPkvN6ZuUVeFDfCL4vCA0HUXLD
+VrOhtUZkNNJlLMiVRJuQKUOGlg8PpObqYbstQAf/0/yFJMRHG82Tcg=
-----END RSA PRIVATE KEY-----`
