package api

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestAlertmanagerApiHandler_isExtraConfig(t *testing.T) {
	tests := []struct {
		name            string
		datasourceUID   string
		flagEnabled     bool
		expectedIsExtra bool
	}{
		{
			name:            "normal datasource when feature enabled",
			datasourceUID:   "normal-datasource",
			flagEnabled:     true,
			expectedIsExtra: false,
		},
		{
			name:            "extra config when feature enabled",
			datasourceUID:   "~grafana-with-extra-config",
			flagEnabled:     true,
			expectedIsExtra: true,
		},
		{
			name:            "extra config when feature disabled",
			datasourceUID:   "~grafana-with-extra-config",
			flagEnabled:     false,
			expectedIsExtra: false,
		},
		{
			name:            "empty datasource UID",
			datasourceUID:   "",
			flagEnabled:     true,
			expectedIsExtra: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &http.Request{}
			ctx := &contextmodel.ReqContext{
				Context: &web.Context{
					Req: req,
				},
				SignedInUser: &user.SignedInUser{
					OrgID: 1,
				},
			}

			ctx.Req = web.SetURLParams(req, map[string]string{
				":DatasourceUID": tt.datasourceUID,
			})

			var features featuremgmt.FeatureToggles
			if tt.flagEnabled {
				features = featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerUI)
			} else {
				features = featuremgmt.WithFeatures()
			}

			handler := &AlertmanagerApiHandler{
				FeatureManager: features,
			}

			isExtra := handler.isExtraConfig(ctx)
			assert.Equal(t, tt.expectedIsExtra, isExtra)
		})
	}
}

func TestAlertmanagerApiHandler_ExtraConfigRouting(t *testing.T) {
	t.Run("GET status returns ready for extra config", func(t *testing.T) {
		req := &http.Request{}
		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: req,
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}

		ctx.Req = web.SetURLParams(req, map[string]string{
			":DatasourceUID": "~grafana-with-extra-config",
		})

		handler := &AlertmanagerApiHandler{
			FeatureManager: featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerUI),
		}

		resp := handler.handleRouteGetAMStatus(ctx, "~grafana-with-extra-config")
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("POST operations return 403 for extra config", func(t *testing.T) {
		req := &http.Request{}
		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: req,
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}

		ctx.Req = web.SetURLParams(req, map[string]string{
			":DatasourceUID": "~grafana-with-extra-config",
		})

		handler := &AlertmanagerApiHandler{
			FeatureManager: featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerUI),
		}

		resp := handler.handleRouteCreateSilence(ctx, apimodels.PostableSilence{}, "~grafana-with-extra-config")
		assert.Equal(t, http.StatusForbidden, resp.Status())

		resp = handler.handleRouteDeleteAlertingConfig(ctx, "~grafana-with-extra-config")
		assert.Equal(t, http.StatusForbidden, resp.Status())

		resp = handler.handleRoutePostAlertingConfig(ctx, apimodels.PostableUserConfig{}, "~grafana-with-extra-config")
		assert.Equal(t, http.StatusForbidden, resp.Status())

		resp = handler.handleRoutePostAMAlerts(ctx, apimodels.PostableAlerts{}, "~grafana-with-extra-config")
		assert.Equal(t, http.StatusForbidden, resp.Status())
	})
}
