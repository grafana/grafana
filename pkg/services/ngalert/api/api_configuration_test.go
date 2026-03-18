package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestExternalAlertmanagerChoice(t *testing.T) {
	tests := []struct {
		name               string
		alertmanagerChoice definitions.AlertmanagersChoice
		datasources        []*datasources.DataSource
		statusCode         int
		message            string
		features           featuremgmt.FeatureToggles
	}{
		{
			name:               "setting the choice to external by having a enabled external am datasource should succeed",
			alertmanagerChoice: definitions.ExternalAlertmanagers,
			datasources: []*datasources.DataSource{
				{
					OrgID: 1,
					Type:  datasources.DS_ALERTMANAGER,
					URL:   "http://localhost:9000",
					JsonData: simplejson.NewFromAny(map[string]any{
						definitions.HandleGrafanaManagedAlerts: true,
					}),
				},
			},
			statusCode: http.StatusCreated,
			message:    "admin configuration updated",
			features:   featuremgmt.WithFeatures(),
		},
		{
			name:               "setting the choice to external by having a disabled external am datasource should fail",
			alertmanagerChoice: definitions.ExternalAlertmanagers,
			datasources: []*datasources.DataSource{
				{
					OrgID:    1,
					Type:     datasources.DS_ALERTMANAGER,
					URL:      "http://localhost:9000",
					JsonData: simplejson.NewFromAny(map[string]any{}),
				},
			},
			statusCode: http.StatusBadRequest,
			message:    "At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option",
			features:   featuremgmt.WithFeatures(),
		},
		{
			name:               "setting the choice to external and having no am configured should fail",
			alertmanagerChoice: definitions.ExternalAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusBadRequest,
			message:            "At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option",
			features:           featuremgmt.WithFeatures(),
		},
		{
			name:               "setting the choice to all and having no external am configured should succeed",
			alertmanagerChoice: definitions.AllAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusCreated,
			message:            "admin configuration updated",
			features:           featuremgmt.WithFeatures(),
		},
		{
			name:               "setting the choice to internal should always succeed",
			alertmanagerChoice: definitions.InternalAlertmanager,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusCreated,
			message:            "admin configuration updated",
			features:           featuremgmt.WithFeatures(),
		},
		{
			name:               "setting the choice to internal should succeed when external disallowed",
			alertmanagerChoice: definitions.InternalAlertmanager,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusCreated,
			message:            "admin configuration updated",
			features:           featuremgmt.WithFeatures(featuremgmt.FlagAlertingDisableSendAlertsExternal),
		},
		{
			name:               "setting the choice to all should fail when external disallowed",
			alertmanagerChoice: definitions.AllAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusBadRequest,
			message:            "Sending alerts to external alertmanagers is disallowed on this instance",
			features:           featuremgmt.WithFeatures(featuremgmt.FlagAlertingDisableSendAlertsExternal),
		},
		{
			name:               "setting the choice to external should fail when external disallowed",
			alertmanagerChoice: definitions.ExternalAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusBadRequest,
			message:            "Sending alerts to external alertmanagers is disallowed on this instance",
			features:           featuremgmt.WithFeatures(featuremgmt.FlagAlertingDisableSendAlertsExternal),
		},
	}
	ctx := createRequestCtxInOrg(1)
	ctx.OrgRole = org.RoleAdmin
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			sut := createAPIAdminSut(t, test.datasources, test.features)
			resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
				AlertmanagersChoice: &test.alertmanagerChoice,
			})
			var res map[string]any
			err := json.Unmarshal(resp.Body(), &res)
			require.NoError(t, err)
			require.Equal(t, test.message, res["message"])
			require.Equal(t, test.statusCode, resp.Status())
		})
	}
}

func createAPIAdminSut(t *testing.T,
	datasources []*datasources.DataSource, features featuremgmt.FeatureToggles) ConfigSrv {
	return ConfigSrv{
		datasourceService: &fakeDatasources.FakeDataSourceService{
			DataSources: datasources,
		},
		store:          store.NewFakeAdminConfigStore(t),
		featureManager: features,
	}
}

func ptrTo[T any](v T) *T { return &v }

func TestRemoteAlertmanagerUID_PostAndGet(t *testing.T) {
	mimirDS := &datasources.DataSource{
		UID:   "mimir-ds-uid",
		OrgID: 1,
		Type:  datasources.DS_ALERTMANAGER,
		URL:   "http://mimir:9009",
		JsonData: simplejson.NewFromAny(map[string]any{
			"implementation": "mimir",
		}),
	}

	t.Run("POST with valid mimir datasource persists remote_alertmanager_uid", func(t *testing.T) {
		sut := createAPIAdminSut(t, []*datasources.DataSource{mimirDS},
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingRemoteAMConfigSync))
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo("mimir-ds-uid"),
		})
		require.Equal(t, http.StatusCreated, resp.Status())

		// Verify persisted via GET.
		getResp := sut.RouteGetNGalertConfig(ctx)
		require.Equal(t, http.StatusOK, getResp.Status())
		var got definitions.GettableNGalertConfig
		require.NoError(t, json.Unmarshal(getResp.Body(), &got))
		require.Equal(t, "mimir-ds-uid", got.RemoteAlertmanagerUID)
	})

	t.Run("POST with remote_alertmanager_uid empty clears it", func(t *testing.T) {
		sut := createAPIAdminSut(t, []*datasources.DataSource{mimirDS},
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingRemoteAMConfigSync))
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		// First set it.
		sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo("mimir-ds-uid"),
		})
		// Then clear it.
		resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo(""),
		})
		require.Equal(t, http.StatusCreated, resp.Status())

		getResp := sut.RouteGetNGalertConfig(ctx)
		var got definitions.GettableNGalertConfig
		require.NoError(t, json.Unmarshal(getResp.Body(), &got))
		require.Empty(t, got.RemoteAlertmanagerUID)
	})

	t.Run("POST with non-existent datasource returns 400", func(t *testing.T) {
		sut := createAPIAdminSut(t, []*datasources.DataSource{},
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingRemoteAMConfigSync))
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo("nonexistent-uid"),
		})
		require.Equal(t, http.StatusBadRequest, resp.Status())
	})

	t.Run("POST with non-alertmanager datasource returns 400", func(t *testing.T) {
		prometheusDS := &datasources.DataSource{
			UID:      "prom-uid",
			OrgID:    1,
			Type:     "prometheus",
			URL:      "http://prom:9090",
			JsonData: simplejson.New(),
		}
		sut := createAPIAdminSut(t, []*datasources.DataSource{prometheusDS},
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingRemoteAMConfigSync))
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo("prom-uid"),
		})
		require.Equal(t, http.StatusBadRequest, resp.Status())
	})

	t.Run("POST with alertmanager datasource but wrong implementation returns 400", func(t *testing.T) {
		vanillaAMDS := &datasources.DataSource{
			UID:   "vanilla-am",
			OrgID: 1,
			Type:  datasources.DS_ALERTMANAGER,
			URL:   "http://am:9093",
			JsonData: simplejson.NewFromAny(map[string]any{
				"implementation": "prometheus",
			}),
		}
		sut := createAPIAdminSut(t, []*datasources.DataSource{vanillaAMDS},
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingRemoteAMConfigSync))
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo("vanilla-am"),
		})
		require.Equal(t, http.StatusBadRequest, resp.Status())
	})

	t.Run("POST with valid UID but feature flag disabled does not validate datasource", func(t *testing.T) {
		// When feature flag is disabled, the datasource validation is skipped.
		// We pass a UID that doesn't exist — should still succeed.
		sut := createAPIAdminSut(t, []*datasources.DataSource{},
			featuremgmt.WithFeatures()) // flag OFF
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
			AlertmanagersChoice: ptrTo(definitions.InternalAlertmanager),
			RemoteAlertmanagerUID:   ptrTo("any-uid"),
		})
		require.Equal(t, http.StatusCreated, resp.Status())
	})

	t.Run("GET returns remote_alertmanager_uid from stored config", func(t *testing.T) {
		adminStore := store.NewFakeAdminConfigStore(t)
		adminStore.Configs[1] = &ngmodels.AdminConfiguration{
			OrgID:             1,
			RemoteAlertmanagerUID: ptrTo("stored-uid"),
		}
		sut := ConfigSrv{
			datasourceService: &fakeDatasources.FakeDataSourceService{},
			store:             adminStore,
			featureManager:    featuremgmt.WithFeatures(),
		}
		ctx := createRequestCtxInOrg(1)
		ctx.OrgRole = org.RoleAdmin

		getResp := sut.RouteGetNGalertConfig(ctx)
		require.Equal(t, http.StatusOK, getResp.Status())
		var got definitions.GettableNGalertConfig
		require.NoError(t, json.Unmarshal(getResp.Body(), &got))
		require.Equal(t, "stored-uid", got.RemoteAlertmanagerUID)
	})
}
