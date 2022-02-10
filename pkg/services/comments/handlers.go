package comments

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
)

func commentsToDto(items []*commentmodel.Comment, userMap map[int64]*models.UserSearchHitDTO) []*commentmodel.CommentDto {
	result := make([]*commentmodel.CommentDto, 0, len(items))
	for _, m := range items {
		result = append(result, commentToDto(m, userMap))
	}
	return result
}

func commentToDto(comment *commentmodel.Comment, userMap map[int64]*models.UserSearchHitDTO) *commentmodel.CommentDto {
	var u *commentmodel.CommentUser
	if comment.UserId > 0 {
		user, ok := userMap[comment.UserId]
		if !ok {
			// TODO: handle this gracefully?
			u = &commentmodel.CommentUser{
				Id: comment.UserId,
			}
		} else {
			u = &commentmodel.CommentUser{
				Id:        user.Id,
				Name:      user.Name,
				Login:     user.Login,
				Email:     user.Email,
				AvatarUrl: dtos.GetGravatarUrl(user.Email),
			}
		}
	}
	return comment.ToDTO(u)
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

type GetCmd struct {
	ContentType string `json:"contentType"`
	ObjectId    string `json:"objectId"`
	Limit       uint   `json:"limit"`
	BeforeId    int64  `json:"beforeId"`
}

type CreateCmd struct {
	ContentType string `json:"contentType"`
	ObjectId    string `json:"objectId"`
	Content     string `json:"content"`
}

var ErrPermissionDenied = errors.New("permission denied")

func (s *Service) Create(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, cmd CreateCmd) (*commentmodel.CommentDto, error) {
	ok, err := s.permissions.CheckWritePermissions(ctx, orgId, signedInUser, cmd.ContentType, cmd.ObjectId)
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

	m, err := s.storage.Create(ctx, orgId, cmd.ContentType, cmd.ObjectId, signedInUser.UserId, cmd.Content)
	if err != nil {
		return nil, err
	}
	mDto := commentToDto(m, userMap)
	e := commentmodel.Event{
		Event:          commentmodel.EventCommentCreated,
		CommentCreated: mDto,
	}
	eventJSON, _ := json.Marshal(e)
	_ = s.live.Publish(orgId, fmt.Sprintf("grafana/comment/%s/%s", cmd.ContentType, cmd.ObjectId), eventJSON)
	return mDto, nil
}

func (s *Service) Get(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, cmd GetCmd) ([]*commentmodel.CommentDto, error) {
	ok, err := s.permissions.CheckReadPermissions(ctx, orgId, signedInUser, cmd.ContentType, cmd.ObjectId)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrPermissionDenied
	}

	messages, err := s.storage.Get(ctx, orgId, cmd.ContentType, cmd.ObjectId, GetFilter{
		Limit:    cmd.Limit,
		BeforeID: cmd.BeforeId,
	})
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

	result := commentsToDto(messages, userMap)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Id < result[j].Id
	})
	return result, nil
}
