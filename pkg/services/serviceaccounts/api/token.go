package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (api *ServiceAccountsAPI) ListTokens(ctx *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}
	if saTokens, err := api.store.ListTokens(ctx.Req.Context(), ctx.OrgId, saID); err == nil {
		result := make([]*models.ApiKeyDTO, len(saTokens))
		for i, t := range saTokens {
			var expiration *time.Time = nil
			if t.Expires != nil {
				v := time.Unix(*t.Expires, 0)
				expiration = &v
			}
			result[i] = &models.ApiKeyDTO{
				Id:         t.Id,
				Name:       t.Name,
				Role:       t.Role,
				Expiration: expiration,
			}
		}

		return response.JSON(200, result)
	} else {
		return response.Error(500, "Internal server error", err)
	}
}
