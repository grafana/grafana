package middleware

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareDashboardRedirect(t *testing.T) {
	Convey("Given the dashboard redirect middleware", t, func() {
		bus.ClearBusHandlers()
		redirectFromLegacyDashboardUrl := RedirectFromLegacyDashboardURL()
		redirectFromLegacyDashboardSoloUrl := RedirectFromLegacyDashboardSoloURL()

		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false
		fakeDash.Uid = util.GenerateShortUID()

		middlewareScenario(t, "GET dashboard by legacy url", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = fakeDash
				return nil
			})

			sc.m.Get("/dashboard/db/:slug", redirectFromLegacyDashboardUrl, sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/dashboard/db/dash?orgId=1&panelId=2", map[string]string{}).exec()

			assert.Equal(t, 301, sc.resp.Code)
			// nolint:bodyclose
			resp := sc.resp.Result()
			t.Cleanup(func() {
				err := resp.Body.Close()
				assert.NoError(t, err)
			})
			redirectURL, err := resp.Location()
			require.NoError(t, err)
			assert.Equal(t, models.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug), redirectURL.Path)
			assert.Equal(t, 2, len(redirectURL.Query()))
		})

		middlewareScenario(t, "GET dashboard solo by legacy url", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = fakeDash
				return nil
			})

			sc.m.Get("/dashboard-solo/db/:slug", redirectFromLegacyDashboardSoloUrl, sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/dashboard-solo/db/dash?orgId=1&panelId=2", map[string]string{}).exec()

			assert.Equal(t, 301, sc.resp.Code)
			// nolint:bodyclose
			resp := sc.resp.Result()
			t.Cleanup(func() {
				err := resp.Body.Close()
				assert.NoError(t, err)
			})
			redirectURL, err := resp.Location()
			require.NoError(t, err)
			expectedURL := models.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug)
			expectedURL = strings.Replace(expectedURL, "/d/", "/d-solo/", 1)
			assert.Equal(t, expectedURL, redirectURL.Path)
			assert.Equal(t, 2, len(redirectURL.Query()))
		})
	})

	middlewareScenario(t, "GET dashboard by legacy edit url", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/d/:uid/:slug", RedirectFromLegacyPanelEditURL(), sc.defaultHandler)

		sc.fakeReqWithParams("GET", "/d/asd/dash?orgId=1&panelId=12&fullscreen&edit", map[string]string{}).exec()

		assert.Equal(t, 301, sc.resp.Code)
		// nolint:bodyclose
		resp := sc.resp.Result()
		t.Cleanup(func() {
			err := resp.Body.Close()
			assert.NoError(t, err)
		})
		redirectURL, err := resp.Location()
		require.NoError(t, err)
		assert.Equal(t, "/d/asd/d/asd/dash?editPanel=12&orgId=1", redirectURL.String())
	})
}
