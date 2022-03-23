package resourcepermissions

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func solveUID(solve UidSolver) web.Handler {
	return func(c *models.ReqContext) {
		if solve != nil && util.IsValidShortUID(web.Params(c.Req)[":resourceID"]) {
			params := web.Params(c.Req)
			id, err := solve(c.Req.Context(), c.OrgId, params[":resourceID"])
			if err != nil {
				c.JsonApiErr(http.StatusNotFound, "Resource not found", err)
				return
			}
			params[":resourceID"] = strconv.FormatInt(id, 10)
			web.SetURLParams(c.Req, params)
		}
	}
}
