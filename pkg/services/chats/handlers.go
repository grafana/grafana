package chats

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/services/chats/chatmodel"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

func messagesToDto(messages []*chatmodel.Message, userMap map[int64]*models.UserSearchHitDTO) []*chatmodel.MessageDto {
	result := make([]*chatmodel.MessageDto, 0, len(messages))
	for _, m := range messages {
		result = append(result, messageToDto(m, userMap))
	}
	return result
}

func messageToDto(m *chatmodel.Message, userMap map[int64]*models.UserSearchHitDTO) *chatmodel.MessageDto {
	var u *chatmodel.MessageUser
	if m.UserId > 0 {
		user, ok := userMap[m.UserId]
		if !ok {
			// TODO: insert dummy object?
			panic("no user")
		}
		u = &chatmodel.MessageUser{
			Id:        user.Id,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
			AvatarUrl: dtos.GetGravatarUrl(user.Email),
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

type GetMessagesCmd struct {
	ContentTypeId int    `json:"contentTypeId"`
	ObjectId      string `json:"objectId"`
}

type SendMessageCmd struct {
	ContentTypeId int    `json:"contentTypeId"`
	ObjectId      string `json:"objectId"`
	Content       string `json:"content"`
}

var ErrPermissionDenied = errors.New("permission denied")

func (s *Service) SendMessage(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, cmd SendMessageCmd) (*chatmodel.MessageDto, error) {
	ok, err := s.permissions.CheckWritePermissions(ctx, orgId, signedInUser, cmd.ContentTypeId, cmd.ObjectId)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrPermissionDenied
	}

	userMap := map[int64]*models.UserSearchHitDTO{}
	if signedInUser.UserId > 0 {
		q := &models.SearchUsersQuery{Query: "", Filters: []models.Filter{NewIDFilter([]int64{signedInUser.UserId})}, Page: 0, Limit: 1}
		if err := s.bus.Dispatch(ctx, q); err != nil {
			return nil, err
		}
		for _, u := range q.Result.Users {
			userMap[u.Id] = u
		}
	}

	m, err := s.storage.CreateMessage(ctx, orgId, cmd.ContentTypeId, cmd.ObjectId, signedInUser.UserId, cmd.Content)
	if err != nil {
		return nil, err
	}
	mDto := messageToDto(m, userMap)
	e := chatmodel.ChatEvent{
		Event:          chatmodel.ChatEventMessageCreated,
		MessageCreated: mDto,
	}
	eventJSON, _ := json.Marshal(e)
	_ = s.live.Publish(orgId, fmt.Sprintf("grafana/chat/%d/%s", cmd.ContentTypeId, cmd.ObjectId), eventJSON)
	return mDto, nil
}

func (s *Service) GetMessages(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, cmd GetMessagesCmd) ([]*chatmodel.MessageDto, error) {
	ok, err := s.permissions.CheckReadPermissions(ctx, orgId, signedInUser, cmd.ContentTypeId, cmd.ObjectId)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrPermissionDenied
	}

	messages, err := s.storage.GetMessages(ctx, orgId, cmd.ContentTypeId, cmd.ObjectId, GetMessagesFilter{})
	if err != nil {
		return nil, err
	}

	userIds := make([]int64, 0, len(messages))
	for _, m := range messages {
		if m.UserId <= 0 {
			continue
		}
		userIds = append(userIds, m.UserId)
	}

	query := &models.SearchUsersQuery{Query: "", Filters: []models.Filter{NewIDFilter(userIds)}, Page: 0, Limit: len(userIds)}
	if err := s.bus.Dispatch(ctx, query); err != nil {
		return nil, err
	}

	userMap := map[int64]*models.UserSearchHitDTO{}
	for _, u := range query.Result.Users {
		userMap[u.Id] = u
	}

	result := messagesToDto(messages, userMap)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Id < result[j].Id
	})
	return result, nil
}
