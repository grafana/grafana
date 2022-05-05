package middleware

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
	"golang.org/x/time/rate"
)

type getTimeFn func() time.Time

// RateLimit is a very basic rate limiter.
// Will allow average of "rps" requests per second over an extended period of time, with max "burst" requests at the same time.
// getTime should return the current time. For non-testing purposes use time.Now
func RateLimit(rps, burst int, getTime getTimeFn) web.Handler {
	l := rate.NewLimiter(rate.Limit(rps), burst)
	return func(c *models.ReqContext) {
		if !l.AllowN(getTime(), 1) {
			c.JsonApiErr(429, "Rate limit reached", nil)
			return
		}
	}
}
