package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
)

func TestExternalAlertmanagerChoice(t *testing.T) {
	tests := []struct {
		name               string
		alertmanagerChoice definitions.AlertmanagersChoice
		datasources        []*datasources.DataSource
		statusCode         int
		message            string
		flagEnabled        bool
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
		},
		{
			name:               "setting the choice to external and having no am configured should fail",
			alertmanagerChoice: definitions.ExternalAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusBadRequest,
			message:            "At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option",
		},
		{
			name:               "setting the choice to all and having no external am configured should succeed",
			alertmanagerChoice: definitions.AllAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusCreated,
			message:            "admin configuration updated",
		},
		{
			name:               "setting the choice to internal should always succeed",
			alertmanagerChoice: definitions.InternalAlertmanager,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusCreated,
			message:            "admin configuration updated",
		},
		{
			name:               "setting the choice to internal should succeed when external disallowed",
			alertmanagerChoice: definitions.InternalAlertmanager,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusCreated,
			message:            "admin configuration updated",
			flagEnabled:        true,
		},
		{
			name:               "setting the choice to all should fail when external disallowed",
			alertmanagerChoice: definitions.AllAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusBadRequest,
			message:            "Sending alerts to external alertmanagers is disallowed on this instance",
			flagEnabled:        true,
		},
		{
			name:               "setting the choice to external should fail when external disallowed",
			alertmanagerChoice: definitions.ExternalAlertmanagers,
			datasources:        []*datasources.DataSource{},
			statusCode:         http.StatusBadRequest,
			message:            "Sending alerts to external alertmanagers is disallowed on this instance",
			flagEnabled:        true,
		},
	}

	ctx := createRequestCtxInOrg(1)
	ctx.OrgRole = org.RoleAdmin
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAlertingDisableSendAlertsExternal: {
					Key:      featuremgmt.FlagAlertingDisableSendAlertsExternal,
					Variants: map[string]any{"": test.flagEnabled},
				},
			}))
			require.NoError(t, err)
			t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })

			sut := createAPIAdminSut(t, test.datasources)
			resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
				AlertmanagersChoice: &test.alertmanagerChoice,
			})
			var res map[string]any
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Equal(t, test.message, res["message"])
			require.Equal(t, test.statusCode, resp.Status())
		})
	}
}

func createAPIAdminSut(
	t *testing.T,
	datasources []*datasources.DataSource,
) ConfigSrv {
	return ConfigSrv{
		datasourceService: &fakeDatasources.FakeDataSourceService{
			DataSources: datasources,
		},
		store: store.NewFakeAdminConfigStore(t),
	}
}

func ptrTo[T any](v T) *T { return &v }

func TestExternalAlertmanagerUID_PostAndGet(t *testing.T) {
	mimirDS := &datasources.DataSource{
		UID:   "mimir-ds-uid",
		OrgID: 1,
		Type:  datasources.DS_ALERTMANAGER,
		URL:   "http://mimir:9009",
		JsonData: simplejson.NewFromAny(map[string]any{
			"implementation": "mimir",
		}),
	}
	prometheusDS := &datasources.DataSource{
		UID:      "prom-uid",
		OrgID:    1,
		Type:     "prometheus",
		URL:      "http://prom:9090",
		JsonData: simplejson.New(),
	}
	vanillaAMDS := &datasources.DataSource{
		UID:   "vanilla-am",
		OrgID: 1,
		Type:  datasources.DS_ALERTMANAGER,
		URL:   "http://am:9093",
		JsonData: simplejson.NewFromAny(map[string]any{
			"implementation": "prometheus",
		}),
	}

	tests := []struct {
		name        string
		datasources []*datasources.DataSource
		flagEnabled bool
		posts       []definitions.PostableNGalertConfig
		wantStatus  int
		wantUID     *string // non-nil triggers a GET assertion on the last POST
	}{
		{
			name:        "POST with valid mimir datasource persists remote_alertmanager_uid",
			datasources: []*datasources.DataSource{mimirDS},
			flagEnabled: true,
			posts: []definitions.PostableNGalertConfig{
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo("mimir-ds-uid"),
				},
			},
			wantStatus: http.StatusCreated,
			wantUID:    ptrTo("mimir-ds-uid"),
		},
		{
			name:        "POST with remote_alertmanager_uid empty clears it",
			datasources: []*datasources.DataSource{mimirDS},
			flagEnabled: true,
			posts: []definitions.PostableNGalertConfig{
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo("mimir-ds-uid"),
				},
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo(""),
				},
			},
			wantStatus: http.StatusCreated,
			wantUID:    ptrTo(""),
		},
		{
			name:        "POST with non-existent datasource returns 400",
			datasources: []*datasources.DataSource{},
			flagEnabled: true,
			posts: []definitions.PostableNGalertConfig{
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo("nonexistent-uid"),
				},
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:        "POST with non-alertmanager datasource returns 400",
			datasources: []*datasources.DataSource{prometheusDS},
			flagEnabled: true,
			posts: []definitions.PostableNGalertConfig{
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo("prom-uid"),
				},
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:        "POST with alertmanager datasource but wrong implementation returns 400",
			datasources: []*datasources.DataSource{vanillaAMDS},
			flagEnabled: true,
			posts: []definitions.PostableNGalertConfig{
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo("vanilla-am"),
				},
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:        "POST with valid UID but feature flag disabled does not validate datasource",
			datasources: []*datasources.DataSource{},
			posts: []definitions.PostableNGalertConfig{
				{
					AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
					ExternalAlertmanagerUID: ptrTo("any-uid"),
				},
			},
			wantStatus: http.StatusCreated,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAlertingSyncExternalAlertmanager: {
					Key:      featuremgmt.FlagAlertingSyncExternalAlertmanager,
					Variants: map[string]any{"": test.flagEnabled},
				},
			}))
			require.NoError(t, err)
			t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })

			sut := createAPIAdminSut(t, test.datasources)
			ctx := createRequestCtxInOrg(1)
			ctx.OrgRole = org.RoleAdmin

			var resp response.Response
			for _, p := range test.posts {
				resp = sut.RoutePostNGalertConfig(ctx, p)
			}
			require.Equal(t, test.wantStatus, resp.Status())

			if test.wantUID != nil {
				getResp := sut.RouteGetNGalertConfig(ctx)
				require.Equal(t, http.StatusOK, getResp.Status())
				var got definitions.GettableNGalertConfig
				require.NoError(t, json.Unmarshal(getResp.Body(), &got))
				require.Equal(t, *test.wantUID, got.ExternalAlertmanagerUID)
			}
		})
	}
}

func TestExternalAlertmanagerUID_ValidateOnlyWhenChanged(t *testing.T) {
	mimirDS := &datasources.DataSource{
		UID:   "mimir-ds-uid",
		OrgID: 1,
		Type:  datasources.DS_ALERTMANAGER,
		URL:   "http://mimir:9009",
		JsonData: simplejson.NewFromAny(map[string]any{
			"implementation": "mimir",
		}),
	}

	err := openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagAlertingSyncExternalAlertmanager: {
			Key:      featuremgmt.FlagAlertingSyncExternalAlertmanager,
			Variants: map[string]any{"": true},
		},
	}))
	require.NoError(t, err)
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })

	dsSvc := &fakeDatasources.FakeDataSourceService{
		DataSources: []*datasources.DataSource{mimirDS},
	}
	sut := ConfigSrv{
		datasourceService: dsSvc,
		store:             store.NewFakeAdminConfigStore(t),
	}
	ctx := createRequestCtxInOrg(1)
	ctx.OrgRole = org.RoleAdmin

	// First POST stores the UID with a valid datasource present.
	resp := sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
		AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
		ExternalAlertmanagerUID: ptrTo("mimir-ds-uid"),
	})
	require.Equal(t, http.StatusCreated, resp.Status())

	// Remove the datasource so any further validation would fail.
	dsSvc.DataSources = nil

	// Re-POST with the same UID (and a different AlertmanagersChoice) — should
	// succeed because validation is skipped when the UID hasn't changed.
	resp = sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
		AlertmanagersChoice:     ptrTo(definitions.AllAlertmanagers),
		ExternalAlertmanagerUID: ptrTo("mimir-ds-uid"),
	})
	require.Equal(t, http.StatusCreated, resp.Status())

	// POST with a different UID against the missing datasource — should fail
	// validation as before.
	resp = sut.RoutePostNGalertConfig(ctx, definitions.PostableNGalertConfig{
		AlertmanagersChoice:     ptrTo(definitions.InternalAlertmanager),
		ExternalAlertmanagerUID: ptrTo("different-uid"),
	})
	require.Equal(t, http.StatusBadRequest, resp.Status())
}
