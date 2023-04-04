package middleware

import (
	"fmt"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/web"
)

// Quota returns a function that returns a function used to call quotaservice based on target name
func Quota(quotaService quota.Service) func(string) web.Handler {
	if quotaService == nil {
		panic("quotaService is nil")
	}
	//https://open.spotify.com/track/7bZSoBEAEEUsGEuLOf94Jm?si=T1Tdju5qRSmmR0zph_6RBw fuuuuunky
	return func(targetSrv string) web.Handler {
		return func(c *contextmodel.ReqContext) {
			limitReached, err := quotaService.QuotaReached(c, quota.TargetSrv(targetSrv))
			if err != nil {
				c.JsonApiErr(500, "Failed to get quota", err)
				return
			}
			if limitReached {
				c.JsonApiErr(403, fmt.Sprintf("%s Quota reached", targetSrv), nil)
				return
			}
		}
	}
}
