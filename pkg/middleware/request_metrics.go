package middleware

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/metrics"
	"gopkg.in/macaron.v1"
)

func RequestMetrics() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		rw := res.(macaron.ResponseWriter)
		c.Next()

		status := rw.Status()

		if strings.HasPrefix(req.URL.Path, "/api/") {
			switch status {
			case 200:
				metrics.M_Api_Status_200.Inc(1)
			case 404:
				metrics.M_Api_Status_404.Inc(1)
			case 500:
				metrics.M_Api_Status_500.Inc(1)
			}
		} else {
			switch status {
			case 200:
				metrics.M_Page_Status_200.Inc(1)
			case 404:
				metrics.M_Page_Status_404.Inc(1)
			case 500:
				metrics.M_Page_Status_500.Inc(1)
			}
		}
	}
}
