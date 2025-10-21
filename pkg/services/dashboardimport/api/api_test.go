package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestImportDashboardAPI(t *testing.T) {
	t.Run("Quota not reached, schema loader service disabled", func(t *testing.T) {
		importDashboardServiceCalled := false
		service := &serviceMock{
			importDashboardFunc: func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
				importDashboardServiceCalled = true
				return nil, nil
			},
		}

		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, featuremgmt.WithFeatures())
		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		t.Run("Not signed in should return 404", func(t *testing.T) {
			cmd := &dashboardimport.ImportDashboardRequest{}
			jsonBytes, err := json.Marshal(cmd)
			require.NoError(t, err)
			req := s.NewPostRequest("/api/dashboards/import", bytes.NewReader(jsonBytes))
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		})

		t.Run("Signed in, empty plugin id and dashboard model empty should return error", func(t *testing.T) {
			cmd := &dashboardimport.ImportDashboardRequest{
				PluginId:  "",
				Dashboard: nil,
			}
			jsonBytes, err := json.Marshal(cmd)
			require.NoError(t, err)
			req := s.NewPostRequest("/api/dashboards/import", bytes.NewReader(jsonBytes))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				UserID: 1,
			})
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		})

		t.Run("Signed in, dashboard model set should call import dashboard service", func(t *testing.T) {
			cmd := &dashboardimport.ImportDashboardRequest{
				Dashboard: simplejson.New(),
			}
			jsonBytes, err := json.Marshal(cmd)
			require.NoError(t, err)
			req := s.NewPostRequest("/api/dashboards/import", bytes.NewReader(jsonBytes))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				UserID: 1,
			})
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusOK, resp.StatusCode)
			require.True(t, importDashboardServiceCalled)
		})

		t.Run("Signed in, dashboard model set, trimdefaults enabled should not call schema loader service", func(t *testing.T) {
			cmd := &dashboardimport.ImportDashboardRequest{
				Dashboard: simplejson.New(),
			}
			jsonBytes, err := json.Marshal(cmd)
			require.NoError(t, err)
			req := s.NewPostRequest("/api/dashboards/import?trimdefaults=true", bytes.NewReader(jsonBytes))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				UserID: 1,
			})
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusOK, resp.StatusCode)
			require.True(t, importDashboardServiceCalled)
		})
	})

	t.Run("Quota not reached, schema loader service enabled", func(t *testing.T) {
		importDashboardServiceCalled := false
		service := &serviceMock{
			importDashboardFunc: func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
				importDashboardServiceCalled = true
				return nil, nil
			},
		}

		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, featuremgmt.WithFeatures())
		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		t.Run("Signed in, dashboard model set, trimdefaults enabled should call schema loader service", func(t *testing.T) {
			cmd := &dashboardimport.ImportDashboardRequest{
				Dashboard: simplejson.New(),
			}
			jsonBytes, err := json.Marshal(cmd)
			require.NoError(t, err)
			req := s.NewPostRequest("/api/dashboards/import?trimdefaults=true", bytes.NewReader(jsonBytes))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				UserID: 1,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsCreate: {}},
				},
			})
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusOK, resp.StatusCode)
			require.True(t, importDashboardServiceCalled)
		})
	})

	t.Run("Quota reached", func(t *testing.T) {
		service := &serviceMock{}
		importDashboardAPI := New(service, quotaServiceFunc(quotaReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, featuremgmt.WithFeatures())

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		t.Run("Signed in, dashboard model set, should return 403 forbidden/quota reached", func(t *testing.T) {
			cmd := &dashboardimport.ImportDashboardRequest{
				Dashboard: simplejson.New(),
			}
			jsonBytes, err := json.Marshal(cmd)
			require.NoError(t, err)
			req := s.NewPostRequest("/api/dashboards/import", bytes.NewReader(jsonBytes))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				UserID: 1,
			})
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
		})
	})
}

func TestInterpolateDashboardFeatureFlag(t *testing.T) {
	t.Run("Feature flag disabled - interpolate endpoint should return 404", func(t *testing.T) {
		service := &serviceMock{}
		// Create features with dashboardLibrary disabled
		features := featuremgmt.WithFeatures()
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		cmd := &dashboardimport.ImportDashboardRequest{
			Dashboard: simplejson.New(),
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsCreate: {}},
			},
		})
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Feature flag enabled - interpolate endpoint should work", func(t *testing.T) {
		interpolateDashboardServiceCalled := false
		service := &serviceMock{
			interpolateDashboardFunc: func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*simplejson.Json, error) {
				interpolateDashboardServiceCalled = true
				return simplejson.New(), nil
			},
		}
		// Create features with dashboardLibrary enabled
		features := featuremgmt.WithFeatures(featuremgmt.FlagDashboardLibrary)
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		cmd := &dashboardimport.ImportDashboardRequest{
			PluginId: "test-plugin",
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsCreate: {}},
			},
		})
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, interpolateDashboardServiceCalled)
	})
}

func TestInterpolateDashboardAPI(t *testing.T) {
	features := featuremgmt.WithFeatures(featuremgmt.FlagDashboardLibrary)

	t.Run("Backward compatibility - plugin-based flow still works", func(t *testing.T) {
		var capturedReq *dashboardimport.ImportDashboardRequest
		interpolateDashboardServiceCalled := false
		service := &serviceMock{
			interpolateDashboardFunc: func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*simplejson.Json, error) {
				interpolateDashboardServiceCalled = true
				capturedReq = req
				result := simplejson.New()
				result.Set("title", "Test Dashboard")
				return result, nil
			},
		}
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		cmd := &dashboardimport.ImportDashboardRequest{
			PluginId: "test-plugin",
			Path:     "dashboards/test.json",
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsCreate: {}},
			},
		})
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, interpolateDashboardServiceCalled)
		require.NotNil(t, capturedReq)
		require.Equal(t, "test-plugin", capturedReq.PluginId)
		require.Equal(t, "dashboards/test.json", capturedReq.Path)
	})

	t.Run("New flow with dashboard JSON - should call service with dashboard", func(t *testing.T) {
		var capturedReq *dashboardimport.ImportDashboardRequest
		interpolateDashboardServiceCalled := false
		service := &serviceMock{
			interpolateDashboardFunc: func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*simplejson.Json, error) {
				interpolateDashboardServiceCalled = true
				capturedReq = req
				result := simplejson.New()
				result.Set("title", "Community Dashboard")
				result.Set("panels", []interface{}{})
				return result, nil
			},
		}
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		// Create a test dashboard with datasource that needs interpolation
		testDashboard := simplejson.New()
		testDashboard.Set("title", "Test Community Dashboard")
		testDashboard.Set("panels", []interface{}{
			map[string]interface{}{
				"datasource": "${DS_PROMETHEUS}",
			},
		})

		cmd := &dashboardimport.ImportDashboardRequest{
			Dashboard: testDashboard,
			Inputs: []dashboardimport.ImportDashboardInput{
				{Name: "DS_PROMETHEUS", Type: "datasource", PluginId: "prometheus", Value: "my-prometheus"},
			},
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsCreate: {}},
			},
		})
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, interpolateDashboardServiceCalled)
		require.NotNil(t, capturedReq)
		require.NotNil(t, capturedReq.Dashboard)
		require.Len(t, capturedReq.Inputs, 1)
		require.Equal(t, "DS_PROMETHEUS", capturedReq.Inputs[0].Name)
	})

	t.Run("Validation - both pluginId and dashboard missing should return error", func(t *testing.T) {
		service := &serviceMock{}
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		cmd := &dashboardimport.ImportDashboardRequest{
			PluginId:  "",
			Dashboard: nil,
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsCreate: {}},
			},
		})
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	})

	t.Run("Response should not include internal fields", func(t *testing.T) {
		service := &serviceMock{
			interpolateDashboardFunc: func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*simplejson.Json, error) {
				result := simplejson.New()
				result.Set("title", "Test Dashboard")
				result.Set("__elements", map[string]interface{}{"test": "value"})
				result.Set("__inputs", []interface{}{})
				result.Set("__requires", []interface{}{})
				result.Set("panels", []interface{}{})
				return result, nil
			},
		}
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		cmd := &dashboardimport.ImportDashboardRequest{
			PluginId: "test-plugin",
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsCreate: {}},
			},
		})
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, resp.Body.Close()) }()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Parse response body and verify internal fields are removed
		var responseBody map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&responseBody)
		require.NoError(t, err)
		require.Equal(t, "Test Dashboard", responseBody["title"])
		require.NotContains(t, responseBody, "__elements")
		require.NotContains(t, responseBody, "__inputs")
		require.NotContains(t, responseBody, "__requires")
	})

	t.Run("Not signed in should return 401", func(t *testing.T) {
		service := &serviceMock{}
		importDashboardAPI := New(service, quotaServiceFunc(quotaNotReached), nil, actest.FakeAccessControl{ExpectedEvaluate: true}, features)

		routeRegister := routing.NewRouteRegister()
		importDashboardAPI.RegisterAPIEndpoints(routeRegister)
		s := webtest.NewServer(t, routeRegister)

		cmd := &dashboardimport.ImportDashboardRequest{
			Dashboard: simplejson.New(),
		}
		jsonBytes, err := json.Marshal(cmd)
		require.NoError(t, err)
		req := s.NewPostRequest("/api/dashboards/interpolate", bytes.NewReader(jsonBytes))
		resp, err := s.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

type serviceMock struct {
	importDashboardFunc      func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error)
	interpolateDashboardFunc func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*simplejson.Json, error)
}

func (s *serviceMock) ImportDashboard(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
	if s.importDashboardFunc != nil {
		return s.importDashboardFunc(ctx, req)
	}

	return nil, nil
}

func (s *serviceMock) InterpolateDashboard(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*simplejson.Json, error) {
	if s.interpolateDashboardFunc != nil {
		return s.interpolateDashboardFunc(ctx, req)
	}

	return simplejson.New(), nil
}

func quotaReached(c *contextmodel.ReqContext, target quota.TargetSrv) (bool, error) {
	return true, nil
}

func quotaNotReached(c *contextmodel.ReqContext, target quota.TargetSrv) (bool, error) {
	return false, nil
}
