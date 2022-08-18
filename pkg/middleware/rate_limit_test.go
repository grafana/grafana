package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type execFunc func() *httptest.ResponseRecorder
type advanceTimeFunc func(deltaTime time.Duration)
type rateLimiterScenarioFunc func(c execFunc, t advanceTimeFunc)

func rateLimiterScenario(t *testing.T, desc string, rps int, burst int, fn rateLimiterScenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		defaultHandler := func(c *models.ReqContext) {
			resp := make(map[string]interface{})
			resp["message"] = "OK"
			c.JSON(http.StatusOK, resp)
		}
		currentTime := time.Now()

		cfg := setting.NewCfg()

		m := web.New()
		m.UseMiddleware(web.Renderer("../../public/views", "[[", "]]"))
		m.Use(getContextHandler(t, cfg, nil, nil, nil, nil).Middleware)
		m.Get("/foo", RateLimit(rps, burst, func() time.Time { return currentTime }), defaultHandler)

		fn(func() *httptest.ResponseRecorder {
			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/foo", nil)
			require.NoError(t, err)
			m.ServeHTTP(resp, req)
			return resp
		}, func(deltaTime time.Duration) {
			currentTime = currentTime.Add(deltaTime)
		})
	})
}

func TestRateLimitMiddleware(t *testing.T) {
	rateLimiterScenario(t, "rate limit calls, with burst", 10, 10, func(doReq execFunc, advanceTime advanceTimeFunc) {
		// first 10 calls succeed
		for i := 0; i < 10; i++ {
			resp := doReq()
			assert.Equal(t, 200, resp.Code)
		}

		// next one fails
		resp := doReq()
		assert.Equal(t, 429, resp.Code)

		// check that requests are accepted again in 1 sec
		advanceTime(1 * time.Second)

		for i := 0; i < 10; i++ {
			resp := doReq()
			assert.Equal(t, 200, resp.Code)
		}
	})

	rateLimiterScenario(t, "rate limit calls, no burst", 10, 1, func(doReq execFunc, advanceTime advanceTimeFunc) {
		// first calls succeeds
		resp := doReq()
		assert.Equal(t, 200, resp.Code)

		// immediately fired next one fails
		resp = doReq()
		assert.Equal(t, 429, resp.Code)

		// but spacing calls out works
		for i := 0; i < 10; i++ {
			advanceTime(100 * time.Millisecond)
			resp := doReq()
			assert.Equal(t, 200, resp.Code)
		}
	})
}
