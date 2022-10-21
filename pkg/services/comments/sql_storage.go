package comments

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
)

type sqlStorage struct {
	sql db.DB
}

func checkObjectType(contentType string) bool {
	_, ok := commentmodel.RegisteredObjectTypes[contentType]
	return ok
}

func checkObjectID(objectID string) bool {
	return objectID != ""
}

func (s *sqlStorage) Create(ctx context.Context, orgID int64, objectType string, objectID string, userID int64, content string) (*commentmodel.Comment, error) {
	if !checkObjectType(objectType) {
		return nil, errUnknownObjectType
	}
	if !checkObjectID(objectID) {
		return nil, errEmptyObjectID
	}
	if content == "" {
		return nil, errEmptyContent
	}

	var result *commentmodel.Comment

	return result, s.sql.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		var group commentmodel.CommentGroup
		has, err := dbSession.NoAutoCondition().Where(
			"org_id=? AND object_type=? AND object_id=?",
			orgID, objectType, objectID,
		).Get(&group)
		if err != nil {
			return err
		}

		nowUnix := time.Now().Unix()

		groupID := group.Id
		if !has {
			group.OrgId = orgID
			group.ObjectType = objectType
			group.ObjectId = objectID
			group.Created = nowUnix
			group.Updated = nowUnix
			group.Settings = commentmodel.Settings{}
			_, err = dbSession.Insert(&group)
			if err != nil {
				return err
			}
			groupID = group.Id
		}
		message := commentmodel.Comment{
			GroupId: groupID,
			UserId:  userID,
			Content: content,
			Created: nowUnix,
			Updated: nowUnix,
		}
		_, err = dbSession.Insert(&message)
		if err != nil {
			return err
		}
		result = &message
		return nil
	})
}

const maxLimit = 300

func (s *sqlStorage) Get(ctx context.Context, orgID int64, objectType string, objectID string, filter GetFilter) ([]*commentmodel.Comment, error) {
	if !checkObjectType(objectType) {
		return nil, errUnknownObjectType
	}
	if !checkObjectID(objectID) {
		return nil, errEmptyObjectID
	}

	var result []*commentmodel.Comment

	limit := 100
	if filter.Limit > 0 {
		limit = int(filter.Limit)
		if limit > maxLimit {
			limit = maxLimit
		}
	}

	return result, s.sql.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		var group commentmodel.CommentGroup
		has, err := dbSession.NoAutoCondition().Where(
			"org_id=? AND object_type=? AND object_id=?",
			orgID, objectType, objectID,
		).Get(&group)
		if err != nil {
			return err
		}
		if !has {
			return nil
		}
		clause := dbSession.Where("group_id=?", group.Id)
		if filter.BeforeID > 0 {
			clause.Where("id < ?", filter.BeforeID)
		}
		return clause.OrderBy("id desc").Limit(limit).Find(&result)
	})
}
