package resourcepermissions

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// solveInheritedScopes will add the inherited scopes to the context param by prefix
// Ex: params["folders:uid:"] = "folders:uid:BCeknZL7k"
func solveInheritedScopes(solve InheritedScopesSolver) web.Handler {
	return func(c *models.ReqContext) {
		if solve != nil && util.IsValidShortUID(web.Params(c.Req)[":resourceID"]) {
			params := web.Params(c.Req)
			scopes, err := solve(c.Req.Context(), c.OrgId, params[":resourceID"])
			if err != nil {
				c.JsonApiErr(http.StatusNotFound, "Resource not found", err)
				return
			}
			for _, scope := range scopes {
				params[ac.ScopePrefix(scope)] = scope
			}
			web.SetURLParams(c.Req, params)
		}
	}
}

func disableMiddleware(shouldDisable bool) web.Handler {
	return func(c *models.ReqContext) {
		if shouldDisable {
			c.Resp.WriteHeader(http.StatusNotFound)
			return
		}
	}
}
