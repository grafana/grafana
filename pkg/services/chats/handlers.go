package chats

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/services/annotations"

	"github.com/grafana/grafana/pkg/services/guardian"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

func messagesToDto(messages []*Message, userMap map[int64]*models.UserSearchHitDTO) []*MessageDto {
	result := make([]*MessageDto, 0, len(messages))
	for _, m := range messages {
		result = append(result, messageToDto(m, userMap))
	}
	return result
}

func messageToDto(m *Message, userMap map[int64]*models.UserSearchHitDTO) *MessageDto {
	var u *MessageUser
	if m.UserId > 0 {
		user, ok := userMap[m.UserId]
		if !ok {
			// TODO: insert dummy object?
			panic("no user")
		}
		u = &MessageUser{
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

func getDashboardByUid(ctx context.Context, orgID int64, uid string) (*models.Dashboard, error) {
	query := models.GetDashboardQuery{Uid: uid, OrgId: orgID}
	if err := bus.Dispatch(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func getDashboardById(ctx context.Context, orgID int64, id int64) (*models.Dashboard, error) {
	query := models.GetDashboardQuery{Id: id, OrgId: orgID}
	if err := bus.Dispatch(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (s *Service) SendMessage(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, cmd SendMessageCmd) (*MessageDto, error) {
	switch cmd.ContentTypeId {
	case ContentTypeOrg:
		if strconv.FormatInt(orgId, 10) != cmd.ObjectId {
			return nil, ErrPermissionDenied
		}
	case ContentTypeDashboard:
		dash, err := getDashboardByUid(ctx, orgId, cmd.ObjectId)
		if err != nil {
			return nil, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanEdit(); err != nil || !ok {
			return nil, ErrPermissionDenied
		}
	case ContentTypeAnnotation:
		repo := annotations.GetRepository()
		annotationID, err := strconv.ParseInt(cmd.ObjectId, 10, 64)
		if err != nil {
			return nil, ErrPermissionDenied
		}
		items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationID, OrgId: orgId})
		if err != nil || len(items) != 1 {
			return nil, ErrPermissionDenied
		}
		dashboardID := items[0].DashboardId
		if dashboardID == 0 {
			return nil, ErrPermissionDenied
		}
		dash, err := getDashboardById(ctx, orgId, dashboardID)
		if err != nil {
			return nil, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanEdit(); err != nil || !ok {
			return nil, ErrPermissionDenied
		}
	default:
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
	e := ChatEvent{
		Event:          ChatEventMessageCreated,
		MessageCreated: mDto,
	}
	eventJSON, _ := json.Marshal(e)
	_ = s.live.Publish(orgId, fmt.Sprintf("grafana/chat/%d/%s", cmd.ContentTypeId, cmd.ObjectId), eventJSON)
	return mDto, nil
}

func (s *Service) GetMessages(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, cmd GetMessagesCmd) ([]*MessageDto, error) {
	fmt.Println(cmd.ContentTypeId)
	switch cmd.ContentTypeId {
	case ContentTypeOrg:
		if strconv.FormatInt(orgId, 10) != cmd.ObjectId {
			return nil, ErrPermissionDenied
		}
	case ContentTypeDashboard:
		dash, err := getDashboardByUid(ctx, orgId, cmd.ObjectId)
		if err != nil {
			return nil, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanView(); err != nil || !ok {
			return nil, ErrPermissionDenied
		}
	case ContentTypeAnnotation:
		repo := annotations.GetRepository()
		annotationID, err := strconv.ParseInt(cmd.ObjectId, 10, 64)
		if err != nil {
			return nil, ErrPermissionDenied
		}
		items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationID, OrgId: orgId})
		if err != nil || len(items) != 1 {
			return nil, ErrPermissionDenied
		}
		dashboardID := items[0].DashboardId
		if dashboardID == 0 {
			return nil, ErrPermissionDenied
		}
		dash, err := getDashboardById(ctx, orgId, dashboardID)
		if err != nil {
			return nil, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanView(); err != nil || !ok {
			return nil, ErrPermissionDenied
		}
	default:
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
