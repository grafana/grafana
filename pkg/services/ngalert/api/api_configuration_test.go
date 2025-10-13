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
				AlertmanagersChoice: test.alertmanagerChoice,
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
