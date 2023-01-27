package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"errors"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var validAccessToken, _ = service.GenerateAccessToken()

func TestRequiresExistingAccessToken(t *testing.T) {
	tests := []struct {
		Name                 string
		Path                 string
		AccessTokenExists    bool
		AccessTokenExistsErr error
		AccessToken          string
		ExpectedResponseCode int
	}{
		{
			Name:                 "Returns 200 when public dashboard with access token exists",
			Path:                 "/api/public/ma/events/myAccesstoken",
			AccessTokenExists:    true,
			AccessTokenExistsErr: nil,
			AccessToken:          validAccessToken,
			ExpectedResponseCode: http.StatusOK,
		},
		{
			Name:                 "Returns 400 when access token is empty",
			Path:                 "/api/public/ma/events/",
			AccessTokenExists:    false,
			AccessTokenExistsErr: nil,
			AccessToken:          "",
			ExpectedResponseCode: http.StatusBadRequest,
		},
		{
			Name:                 "Returns 400 when invalid access token",
			Path:                 "/api/public/ma/events/myAccesstoken",
			AccessTokenExists:    false,
			AccessTokenExistsErr: nil,
			AccessToken:          "invalidAccessToken",
			ExpectedResponseCode: http.StatusBadRequest,
		},
		{
			Name:                 "Returns 404 when public dashboard with access token does not exist",
			Path:                 "/api/public/ma/events/myAccesstoken",
			AccessTokenExists:    false,
			AccessTokenExistsErr: nil,
			AccessToken:          validAccessToken,
			ExpectedResponseCode: http.StatusNotFound,
		},
		{
			Name:                 "Returns 500 when public dashboard service gives an error",
			Path:                 "/api/public/ma/events/myAccesstoken",
			AccessTokenExists:    false,
			AccessTokenExistsErr: fmt.Errorf("error not found"),
			AccessToken:          validAccessToken,
			ExpectedResponseCode: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			publicdashboardService := &publicdashboards.FakePublicDashboardService{}
			publicdashboardService.On("ExistsEnabledByAccessToken", mock.Anything, mock.Anything).Return(tt.AccessTokenExists, tt.AccessTokenExistsErr)
			params := map[string]string{":accessToken": tt.AccessToken}
			mw := RequiresExistingAccessToken(publicdashboardService)
			_, resp := runMw(t, nil, "GET", tt.Path, params, mw)
			require.Equal(t, tt.ExpectedResponseCode, resp.Code)
		})
	}
}

func TestSetPublicDashboardOrgIdOnContext(t *testing.T) {
	tests := []struct {
		Name          string
		AccessToken   string
		OrgIdResp     int64
		ErrorResp     error
		ExpectedOrgId int64
	}{
		{
			Name:          "Adds orgId for enabled public dashboard",
			AccessToken:   validAccessToken,
			OrgIdResp:     7,
			ErrorResp:     nil,
			ExpectedOrgId: 7,
		},
		{
			Name:          "Does not set orgId or fail with invalid accessToken",
			AccessToken:   "invalidAccessToken",
			OrgIdResp:     0,
			ErrorResp:     nil,
			ExpectedOrgId: 0,
		},
		{
			Name:          "Does not set orgId or fail with disabled public dashboard",
			AccessToken:   validAccessToken,
			OrgIdResp:     0,
			ErrorResp:     nil,
			ExpectedOrgId: 0,
		},
		{
			Name:          "Does not set orgId or fail with error querying public dashboard",
			AccessToken:   validAccessToken,
			OrgIdResp:     0,
			ErrorResp:     errors.New("database error of some sort"),
			ExpectedOrgId: 0,
		},
		{
			Name:          "Does not set orgId or fail with missing public dashboard",
			AccessToken:   validAccessToken,
			OrgIdResp:     0,
			ErrorResp:     nil,
			ExpectedOrgId: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			publicdashboardService := &publicdashboards.FakePublicDashboardService{}
			publicdashboardService.On("GetOrgIdByAccessToken", mock.Anything, tt.AccessToken).Return(
				tt.OrgIdResp,
				tt.ErrorResp,
			)

			params := map[string]string{":accessToken": tt.AccessToken}
			mw := SetPublicDashboardOrgIdOnContext(publicdashboardService)
			ctx, _ := runMw(t, nil, "GET", "/public-dashboard/myaccesstoken", params, mw)
			assert.Equal(t, tt.ExpectedOrgId, ctx.OrgID)
		})
	}
}

func TestSetPublicDashboardFlag(t *testing.T) {
	t.Run("Adds context.IsPublicDashboardView=true to request", func(t *testing.T) {
		ctx := &contextmodel.ReqContext{}
		SetPublicDashboardFlag(ctx)
		assert.True(t, ctx.IsPublicDashboardView)
	})
}

// This is a helper to test middleware. It handles creating a
// proper contextmodel.ReqContext, setting web parameters, executing middleware, and
// returning a response. Response will default to result of
// httptest.NewRecorder() return value and will only change if modified by the
// middlware as this will no accept a handler method
func runMw(t *testing.T, ctx *contextmodel.ReqContext, httpmethod string, path string, webparams map[string]string, mw func(c *contextmodel.ReqContext)) (*contextmodel.ReqContext, *httptest.ResponseRecorder) {
	// create valid request context and set 0 values if they don't exist
	if ctx == nil {
		ctx = &contextmodel.ReqContext{}
	}
	if ctx.Context == nil {
		ctx.Context = &web.Context{}
	}
	if ctx.SignedInUser == nil {
		ctx.SignedInUser = &user.SignedInUser{}
	}

	// create request and add params
	request, err := http.NewRequest(httpmethod, path, nil)
	require.NoError(t, err)
	request = web.SetURLParams(request, webparams)
	ctx.Req = request

	// setup response recorder to return
	response := httptest.NewRecorder()
	ctx.Context.Resp = web.NewResponseWriter("GET", response)

	// run middleware
	mw(ctx)

	// return result
	return ctx, response
}
