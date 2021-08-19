package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareDashboardRedirect_legacyEditPanel(t *testing.T) {
	middlewareScenario(t, "GET dashboard by legacy edit URL", func(t *testing.T, sc *scenarioContext) {
		sc.handlerFunc = RedirectFromLegacyPanelEditURL(sc.cfg)
		sc.m.Get("/d/:uid/:slug", sc.defaultHandler)

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
