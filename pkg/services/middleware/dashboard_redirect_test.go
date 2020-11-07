package middleware

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareDashboardRedirect(t *testing.T) {
	bus.ClearBusHandlers()

	fakeDash := models.NewDashboard("Child dash")
	fakeDash.Id = 1
	fakeDash.FolderId = 1
	fakeDash.HasAcl = false
	fakeDash.Uid = util.GenerateShortUID()

	bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
		query.Result = fakeDash
		return nil
	})

	middlewareScenario(t, "GET dashboard by legacy url", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/dashboard/db/:slug", sc.service.RedirectFromLegacyDashboardURL, sc.defaultHandler)

		sc.fakeReqWithParams(t, "GET", "/dashboard/db/dash?orgId=1&panelId=2", map[string]string{}).exec(t)

		assert.Equal(t, 301, sc.resp.Code)
		resp := sc.resp.Result()
		defer resp.Body.Close()
		redirectURL, err := resp.Location()
		require.NoError(t, err)
		assert.Equal(t, models.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug), redirectURL.Path)
		assert.Len(t, redirectURL.Query(), 2)
	})

	middlewareScenario(t, "GET dashboard solo by legacy url", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/dashboard-solo/db/:slug", sc.service.RedirectFromLegacyDashboardSoloURL, sc.defaultHandler)

		sc.fakeReqWithParams(t, "GET", "/dashboard-solo/db/dash?orgId=1&panelId=2", map[string]string{}).exec(t)

		require.Equal(t, 301, sc.resp.Code)
		resp := sc.resp.Result()
		defer resp.Body.Close()
		redirectURL, err := resp.Location()
		require.NoError(t, err)
		// XXX: Should this be called path??
		expectedURL := models.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug)
		expectedURL = strings.Replace(expectedURL, "/d/", "/d-solo/", 1)
		assert.Equal(t, expectedURL, redirectURL.Path)
		assert.Len(t, redirectURL.Query(), 2)
	})
}

func TestMiddlewareDashboardRedirect_legacyEditPanel(t *testing.T) {
	bus.ClearBusHandlers()

	middlewareScenario(t, "GET dashboard by legacy edit url", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/d/:uid/:slug", sc.service.RedirectFromLegacyPanelEditURL, sc.defaultHandler)

		sc.fakeReqWithParams(t, "GET", "/d/asd/dash?orgId=1&panelId=12&fullscreen&edit", map[string]string{}).exec(t)

		resp := sc.resp.Result()
		defer resp.Body.Close()
		require.Equal(t, 301, resp.StatusCode)
		redirectURL, err := resp.Location()
		require.NoError(t, err)
		assert.Equal(t, "/d/asd/d/asd/dash?editPanel=12&orgId=1", redirectURL.String())
	})
}
