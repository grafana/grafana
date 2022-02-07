package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/chats"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) chatGetMessages(c *models.ReqContext) response.Response {
	cmd := chats.GetMessagesCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	messages, err := hs.chatsService.GetMessages(c.Req.Context(), c.OrgId, c.SignedInUser, cmd)
	if err != nil {
		if errors.Is(err, chats.ErrPermissionDenied) {
			return response.Error(http.StatusForbidden, "permission denied", err)
		}
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}
	return response.JSON(200, util.DynMap{
		"chatMessages": messages,
	})
}

func (hs *HTTPServer) chatSendMessage(c *models.ReqContext) response.Response {
	cmd := chats.SendMessageCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if c.SignedInUser.UserId == 0 && !c.SignedInUser.HasRole(models.ROLE_ADMIN) {
		return response.Error(http.StatusForbidden, "admin role required", nil)
	}
	message, err := hs.chatsService.SendMessage(c.Req.Context(), c.OrgId, c.SignedInUser, cmd)
	if err != nil {
		if errors.Is(err, chats.ErrPermissionDenied) {
			return response.Error(http.StatusForbidden, "permission denied", err)
		}
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}
	return response.JSON(200, util.DynMap{
		"chatMessage": message,
	})
}
