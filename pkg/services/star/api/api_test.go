package api

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestStarDashboardID(t *testing.T) {
	api := ProvideApi(startest.NewStarServiceFake(), dashboards.NewFakeDashboardService(t))

	testCases := []struct {
		name           string
		signedInUser   *user.SignedInUser
		expectedStatus int
		params         map[string]string
	}{
		{
			name: "Star dashboard with user",
			params: map[string]string{
				":id": "1",
			},
			signedInUser: &user.SignedInUser{
				UserID:      1,
				OrgID:       1,
				IsAnonymous: false,
			},
			expectedStatus: 200,
		},
		{
			name: "Star dashboard with anonymous user",
			params: map[string]string{
				":id": "1",
			},
			signedInUser: &user.SignedInUser{
				UserID:      0,
				OrgID:       1,
				IsAnonymous: true,
			},
			expectedStatus: 400,
		},
		{
			name: "Star dashboard with API Key",
			params: map[string]string{
				":id": "1",
			},
			signedInUser: &user.SignedInUser{
				UserID:      0,
				OrgID:       1,
				ApiKeyID:    3,
				IsAnonymous: false,
			},
			expectedStatus: 400,
		},
		{
			name: "Star dashboard with Service Account",
			params: map[string]string{
				":id": "1",
			},
			signedInUser: &user.SignedInUser{
				UserID:           1,
				OrgID:            3,
				IsServiceAccount: true,
			},
			expectedStatus: 200,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := web.SetURLParams(&http.Request{}, tc.params)
			c := &contextmodel.ReqContext{SignedInUser: tc.signedInUser, Context: &web.Context{Req: req}}
			resp := api.StarDashboard(c)
			assert.Equal(t, tc.expectedStatus, resp.Status())
		})
	}
}

func TestStarDashboardUID(t *testing.T) {
	svc := dashboards.NewFakeDashboardService(t)
	svc.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{UID: "test", OrgID: 1}, nil)
	api := ProvideApi(startest.NewStarServiceFake(), svc)

	testCases := []struct {
		name           string
		signedInUser   *user.SignedInUser
		expectedStatus int
		params         map[string]string
	}{
		{
			name: "Star dashboard with user",
			params: map[string]string{
				":uid": "test",
			},
			signedInUser: &user.SignedInUser{
				UserID:      1,
				OrgID:       1,
				IsAnonymous: false,
			},
			expectedStatus: 200,
		},
		{
			name: "Star dashboard with anonymous user",
			params: map[string]string{
				":uid": "test",
			},
			signedInUser: &user.SignedInUser{
				UserID:      0,
				OrgID:       1,
				IsAnonymous: true,
			},
			expectedStatus: 400,
		},
		{
			name: "Star dashboard with API Key",
			params: map[string]string{
				":uid": "test",
			},
			signedInUser: &user.SignedInUser{
				UserID:      0,
				OrgID:       1,
				ApiKeyID:    3,
				IsAnonymous: false,
			},
			expectedStatus: 400,
		},
		{
			name: "Star dashboard with Service Account",
			params: map[string]string{
				":uid": "test",
			},
			signedInUser: &user.SignedInUser{
				UserID:           1,
				OrgID:            3,
				IsServiceAccount: true,
			},
			expectedStatus: 200,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := web.SetURLParams(&http.Request{}, tc.params)
			c := &contextmodel.ReqContext{SignedInUser: tc.signedInUser, Context: &web.Context{Req: req}}
			resp := api.StarDashboardByUID(c)
			assert.Equal(t, tc.expectedStatus, resp.Status())
		})
	}
}
