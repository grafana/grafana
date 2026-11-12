package api

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestIndexTemplate_LiveDisabled(t *testing.T) {
	tmpl, err := template.New("index.html").Delims("[[", "]]").ParseFiles("../../public/views/index.html")
	require.NoError(t, err)

	for _, disabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("disabled=%t", disabled), func(t *testing.T) {
			var output bytes.Buffer
			err := tmpl.Execute(&output, &dtos.IndexViewData{
				User:         &dtos.CurrentUser{},
				Settings:     &dtos.FrontendSettingsDTO{LiveEnabled: true},
				Assets:       &dtos.EntryPointAssets{},
				LiveDisabled: disabled,
			})
			require.NoError(t, err)
			if disabled {
				assert.Contains(t, output.String(), "window.grafanaBootData.settings.liveEnabled = false;")
			} else {
				assert.NotContains(t, output.String(), "window.grafanaBootData.settings.liveEnabled = false;")
			}
		})
	}
}

func TestGetUserOrgCountSingleOrganization(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBAC.SingleOrganization = true
	orgService := &orgtest.MockService{}
	orgService.On("GetUserOrgList", mock.Anything, &org.GetUserOrgListQuery{UserID: 42}).
		Return([]*org.UserOrgDTO{}, nil).Maybe()
	hs := &HTTPServer{
		Cfg:        cfg,
		orgService: orgService,
		tracer:     tracing.InitializeTracerForTest(),
	}
	c := &contextmodel.ReqContext{
		Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)},
	}

	assert.Equal(t, 1, hs.getUserOrgCount(c, 42))
	orgService.AssertNotCalled(t, "GetUserOrgList", mock.Anything, mock.Anything)
}

func TestGetUserOrgCountMultipleOrganizations(t *testing.T) {
	tests := []struct {
		name     string
		userID   int64
		orgs     []*org.UserOrgDTO
		err      error
		expected int
	}{
		{name: "anonymous user", expected: 1},
		{name: "user with multiple organizations", userID: 42, orgs: []*org.UserOrgDTO{{OrgID: 1}, {OrgID: 2}}, expected: 2},
		{name: "user with no organizations", userID: 42, expected: 0},
		{name: "lookup error", userID: 42, err: errors.New("org lookup failed"), expected: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			orgService := &orgtest.MockService{}
			if test.userID != 0 {
				orgService.On("GetUserOrgList", mock.Anything, &org.GetUserOrgListQuery{UserID: test.userID}).
					Return(test.orgs, test.err).Once()
			}
			hs := &HTTPServer{
				Cfg:        setting.NewCfg(),
				orgService: orgService,
				tracer:     tracing.InitializeTracerForTest(),
				log:        log.NewNopLogger(),
			}
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)},
			}

			assert.Equal(t, test.expected, hs.getUserOrgCount(c, test.userID))
			orgService.AssertExpectations(t)
			if test.userID == 0 {
				orgService.AssertNotCalled(t, "GetUserOrgList", mock.Anything, mock.Anything)
			}
		})
	}
}
