package middleware

import (
	"golang.org/x/time/rate"
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
)

// A very basic rate limiter. Will alow average of "rps" requests per second over an extended period of time, with max "burst" requests at the same time
func RateLimit(rps, burst int) macaron.Handler {
	l := rate.NewLimiter(rate.Limit(rps), burst)
	return func(c *models.ReqContext) {
		if !l.Allow() {
			c.JsonApiErr(429, "Rate limit reached.", nil)
			return
		}
	}
}
