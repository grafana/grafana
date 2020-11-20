package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"
)

type execFunc func() *httptest.ResponseRecorder
type rateLimiterScenarioFunc func(c execFunc)

func rateLimiterScenario(t *testing.T, desc string, rps int, burst int, fn rateLimiterScenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		m := macaron.New()
		defaultHandler := func(c *models.ReqContext) {
			resp := make(map[string]interface{})
			resp["message"] = "OK"
			c.JSON(200, resp)
		}
		m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: "",
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))
		m.Use(GetContextHandler(nil, nil, nil))
		m.Get("/foo", RateLimit(rps, burst), defaultHandler)

		fn(func() *httptest.ResponseRecorder {
			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/foo", nil)
			require.NoError(t, err)
			m.ServeHTTP(resp, req)
			return resp
		})
	})
}

func TestRateLimitMiddleware(t *testing.T) {
	rateLimiterScenario(t, "rate limit calls, with burst", 10, 10, func(doReq execFunc) {
		// first 10 calls succeed
		for i := 0; i < 10; i++ {
			resp := doReq()
			assert.Equal(t, 200, resp.Code)
		}

		// next one fails
		resp := doReq()
		assert.Equal(t, 429, resp.Code)

		// wait 1 for limiter tokens to appear, check that requests are accepted again
		time.Sleep(1 * time.Second)

		for i := 0; i < 10; i++ {
			resp := doReq()
			assert.Equal(t, 200, resp.Code)
		}
	})

	rateLimiterScenario(t, "rate limit calls, no burst", 10, 1, func(doReq execFunc) {
		// first calls succeeds
		resp := doReq()
		assert.Equal(t, 200, resp.Code)

		// immediately fired next one fails
		resp = doReq()
		assert.Equal(t, 429, resp.Code)

		// but spacing calls out works
		for i := 0; i < 10; i++ {
			time.Sleep(100 * time.Millisecond)
			resp := doReq()
			assert.Equal(t, 200, resp.Code)
		}
	})
}
