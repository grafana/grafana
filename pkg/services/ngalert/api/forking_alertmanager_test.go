package api

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestAlertmanagerApiHandler_isExtraConfig(t *testing.T) {
	tests := []struct {
		name               string
		datasourceUID      string
		flagEnabled        bool
		expectedIsExtra    bool
		expectedIdentifier string
	}{
		{
			name:               "normal datasource when feature enabled",
			datasourceUID:      "normal-datasource",
			flagEnabled:        true,
			expectedIsExtra:    false,
			expectedIdentifier: "",
		},
		{
			name:               "extra config when feature enabled",
			datasourceUID:      "~grafana-converted-extra-config-test-config",
			flagEnabled:        true,
			expectedIsExtra:    true,
			expectedIdentifier: "test-config",
		},
		{
			name:               "extra config when feature disabled",
			datasourceUID:      "~grafana-converted-extra-config-test-config",
			flagEnabled:        false,
			expectedIsExtra:    false,
			expectedIdentifier: "",
		},
		{
			name:               "empty datasource UID",
			datasourceUID:      "",
			flagEnabled:        true,
			expectedIsExtra:    false,
			expectedIdentifier: "",
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

			isExtra, identifier := handler.isExtraConfig(ctx)
			assert.Equal(t, tt.expectedIsExtra, isExtra)
			assert.Equal(t, tt.expectedIdentifier, identifier)
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
			":DatasourceUID": "~grafana-converted-extra-config-test",
		})

		handler := &AlertmanagerApiHandler{
			FeatureManager: featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerUI),
		}

		resp := handler.handleRouteGetAMStatus(ctx, "~grafana-converted-extra-config-test")
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
			":DatasourceUID": "~grafana-converted-extra-config-test",
		})

		handler := &AlertmanagerApiHandler{
			FeatureManager: featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerUI),
		}

		resp := handler.handleRouteCreateSilence(ctx, apimodels.PostableSilence{}, "~grafana-converted-extra-config-test")
		assert.Equal(t, http.StatusForbidden, resp.Status())

		resp = handler.handleRouteDeleteAlertingConfig(ctx, "~grafana-converted-extra-config-test")
		assert.Equal(t, http.StatusForbidden, resp.Status())

		resp = handler.handleRoutePostAlertingConfig(ctx, apimodels.PostableUserConfig{}, "~grafana-converted-extra-config-test")
		assert.Equal(t, http.StatusForbidden, resp.Status())

		resp = handler.handleRoutePostAMAlerts(ctx, apimodels.PostableAlerts{}, "~grafana-converted-extra-config-test")
		assert.Equal(t, http.StatusForbidden, resp.Status())
	})

	t.Run("GET extra config", func(t *testing.T) {
		req := &http.Request{
			Header: make(http.Header),
		}
		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: req,
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}

		ctx.Req = web.SetURLParams(req, map[string]string{
			":DatasourceUID": "~grafana-converted-extra-config-test-identifier",
		})

		mockConvertSvc := &mockConvertService{}

		yamlConfig := `alertmanager_config: |
  global: {}
  route:
    receiver: test-receiver
  receivers:
    - name: test-receiver`

		mockResponse := response.Respond(http.StatusOK, yamlConfig).
			SetHeader("Content-Type", "application/yaml")

		mockConvertSvc.On("RouteConvertPrometheusGetAlertmanagerConfig", mock.Anything).
			Run(func(args mock.Arguments) {
				passedCtx := args.Get(0).(*contextmodel.ReqContext)
				assert.Equal(t, "test-identifier", passedCtx.Req.Header.Get(configIdentifierHeader))
				assert.Equal(t, "application/yaml", passedCtx.Req.Header.Get("Accept"))
			}).
			Return(mockResponse)

		handler := &AlertmanagerApiHandler{
			FeatureManager: featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerUI),
			ConvertSvc:     mockConvertSvc,
		}

		resp := handler.handleRouteGetAlertingConfig(ctx, "~grafana-converted-extra-config-test-identifier")
		assert.Equal(t, http.StatusOK, resp.Status())

		mockConvertSvc.AssertExpectations(t)
	})
}

type mockConvertService struct {
	mock.Mock
}

func (m *mockConvertService) RouteConvertPrometheusGetAlertmanagerConfig(ctx *contextmodel.ReqContext) response.Response {
	args := m.Called(ctx)
	return args.Get(0).(response.Response)
}
