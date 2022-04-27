package api

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/stretchr/testify/assert"
	"net/http"
	"strings"
	"testing"
)

// create test
// create http server
// post req to save dashboard config
// assert 404 when no feature flag

func TestReturns404WhenFeatureNotEnabled(t *testing.T) {
	sc := setupHTTPServerWithMockDb(t, false, false)

	setInitCtxSignedInViewer(sc.initCtx)
	sc.hs.queryDataService = query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		fakes.NewFakeSecretsService(),
		&dashboardFakePluginClient{},
		&fakeOAuthTokenService{},
	)

	sc.hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards, false)
	dashboardUid := "1"

	t.Run("get 404 when feature flag off", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/uid/%s/sharing", dashboardUid),
			strings.NewReader("{ isPublic: true }"),
			t,
		)
		assert.Equal(t, http.StatusNotFound, response.Code)
	})
}

func TestReturnsSuccessWhenFeatureEnabledAndSetsPublicFlagOnDashboard(t *testing.T) {
	sc := setupHTTPServerWithMockDb(t, false, false)

	setInitCtxSignedInViewer(sc.initCtx)
	sc.hs.queryDataService = query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		fakes.NewFakeSecretsService(),
		&dashboardFakePluginClient{},
		&fakeOAuthTokenService{},
	)

	sc.hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards, true)
	dashboardUid := "1"

	t.Run("get 200 when feature flag on and public flag set on dashboard", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/uid/%s/sharing", dashboardUid),
			strings.NewReader("{ isPublic: true }"),
			t,
		)
		assert.Equal(t, http.StatusOK, response.Code)
		fmt.Println(response.Body)
		respJSON, _ := simplejson.NewJson(response.Body.Bytes())
		assert.Equal(t, "true", respJSON.Get("isPublic"))
	})
}

// create test
// enable feature flag
// create http server
// post req to save dashboard config
// assert successful and that flag === 1 for public
