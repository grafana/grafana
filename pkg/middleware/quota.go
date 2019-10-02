package middleware

import (
	"fmt"

	"gopkg.in/macaron.v1"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/quota"
)

// Quota returns a function that returns a function used to call quotaservice based on target name
func Quota(quotaService *quota.QuotaService) func(target string) macaron.Handler {
	//https://open.spotify.com/track/7bZSoBEAEEUsGEuLOf94Jm?si=T1Tdju5qRSmmR0zph_6RBw fuuuuunky
	return func(target string) macaron.Handler {
		return func(c *m.ReqContext) {
			limitReached, err := quotaService.QuotaReached(c, target)
			if err != nil {
				c.JsonApiErr(500, "failed to get quota", err)
				return
			}
			if limitReached {
				c.JsonApiErr(403, fmt.Sprintf("%s Quota reached", target), nil)
				return
			}
		}
	}
}
