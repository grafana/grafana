package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/comments"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) commentsGet(c *models.ReqContext) response.Response {
	cmd := comments.GetCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	items, err := hs.commentsService.Get(c.Req.Context(), c.OrgID, c.SignedInUser, cmd)
	if err != nil {
		if errors.Is(err, comments.ErrPermissionDenied) {
			return response.Error(http.StatusForbidden, "permission denied", err)
		}
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"comments": items,
	})
}

func (hs *HTTPServer) commentsCreate(c *models.ReqContext) response.Response {
	cmd := comments.CreateCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if c.SignedInUser.UserID == 0 && !c.SignedInUser.HasRole(org.RoleAdmin) {
		return response.Error(http.StatusForbidden, "admin role required", nil)
	}
	comment, err := hs.commentsService.Create(c.Req.Context(), c.OrgID, c.SignedInUser, cmd)
	if err != nil {
		if errors.Is(err, comments.ErrPermissionDenied) {
			return response.Error(http.StatusForbidden, "permission denied", err)
		}
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"comment": comment,
	})
}
