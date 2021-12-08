package api

import (
	"net/http"
	"sort"

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
	messages, err := hs.chatsService.GetMessages(c.Req.Context(), c.OrgId, c.UserId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}

	userIds := make([]int64, 0, len(messages))
	for _, m := range messages {
		if m.UserId <= 0 {
			continue
		}
		userIds = append(userIds, m.UserId)
	}

	query := &models.SearchUsersQuery{Query: "", Filters: []models.Filter{NewIDFilter(userIds)}, Page: 0, Limit: len(userIds)}
	if err := hs.Bus.DispatchCtx(c.Req.Context(), query); err != nil {
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}

	userMap := map[int64]*models.UserSearchHitDTO{}
	for _, u := range query.Result.Users {
		userMap[u.Id] = u
	}

	result := messagesToDto(messages, userMap)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Id < result[j].Id
	})
	return response.JSON(200, util.DynMap{
		"chatMessages": result,
	})
}

func messagesToDto(messages []*chats.Message, userMap map[int64]*models.UserSearchHitDTO) []chats.MessageDto {
	result := make([]chats.MessageDto, 0, len(messages))
	for _, m := range messages {
		result = append(result, messageToDto(m, userMap))
	}
	return result
}

func messageToDto(m *chats.Message, userMap map[int64]*models.UserSearchHitDTO) chats.MessageDto {
	var u *chats.MessageUser
	if m.UserId > 0 {
		user, ok := userMap[m.UserId]
		if !ok {
			// TODO: insert dummy object?
			panic("no user")
		}
		u = &chats.MessageUser{
			Id:        user.Id,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
			AvatarUrl: user.AvatarUrl,
		}
	}
	return m.ToDTO(u)
}

type UserIDFilter struct {
	userIDs []int64
}

func NewIDFilter(userIDs []int64) models.Filter {
	return &UserIDFilter{userIDs: userIDs}
}

func (a *UserIDFilter) WhereCondition() *models.WhereCondition {
	return nil
}

func (a *UserIDFilter) JoinCondition() *models.JoinCondition {
	return nil
}

func (a *UserIDFilter) InCondition() *models.InCondition {
	return &models.InCondition{
		Condition: "u.id",
		Params:    a.userIDs,
	}
}

func (hs *HTTPServer) chatSendMessage(c *models.ReqContext) response.Response {
	cmd := chats.SendMessageCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if c.SignedInUser.UserId == 0 && !c.SignedInUser.HasRole(models.ROLE_ADMIN) {
		return response.Error(http.StatusForbidden, "admin role required", nil)
	}
	message, err := hs.chatsService.SendMessage(c.Req.Context(), c.OrgId, c.SignedInUser.UserId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "internal error", err)
	}

	userMap := map[int64]*models.UserSearchHitDTO{}
	if message.UserId > 0 {
		q := &models.SearchUsersQuery{Query: "", Filters: []models.Filter{NewIDFilter([]int64{message.UserId})}, Page: 0, Limit: 1}
		if err := hs.Bus.DispatchCtx(c.Req.Context(), q); err != nil {
			return response.Error(http.StatusInternalServerError, "internal error", err)
		}
		for _, u := range q.Result.Users {
			userMap[u.Id] = u
		}
	}

	return response.JSON(200, util.DynMap{
		"chatMessage": messageToDto(message, userMap),
	})
}
