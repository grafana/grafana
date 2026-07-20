package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestLivePush_AccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.AppURL = "http://localhost:3000/"
	gLive, err := live.ProvideService(cfg,
		routing.NewRouteRegister(),
		nil, nil, nil, nil,
		&usagestats.UsageStatsMock{T: t},
		featuremgmt.WithFeatures(),
		&dashboards.FakeDashboardService{}, nil)
	require.NoError(t, err)
	gateway := pushhttp.ProvideService(cfg, gLive)

	tests := []struct {
		desc         string
		permissions  []accesscontrol.Permission
		expectedCode int
	}{
		{
			desc:         "should return 403 when user does not have live:push permission",
			permissions:  []accesscontrol.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "should return 200 when user has live:push permission and sends valid Influx line protocol",
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionLivePush},
			},
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = cfg
				hs.Live = gLive
				hs.LivePushGateway = gateway
				hs.AccessControl = acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
			})

			req := server.NewRequest(http.MethodPost, "/api/live/push/mystream", strings.NewReader("cpu usage=0.5"))
			req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, tt.permissions))

			res, err := server.Send(req)
			require.NoError(t, err)
			defer func() { _ = res.Body.Close() }()

			assert.Equal(t, tt.expectedCode, res.StatusCode, "response status for %s", tt.desc)
		})
	}
}
