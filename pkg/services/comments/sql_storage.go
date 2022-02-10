package comments

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type sqlStorage struct {
	sql *sqlstore.SQLStore
}

func checkContentType(contentType string) bool {
	_, ok := commentmodel.RegisteredContentTypes[contentType]
	return ok
}

func checkObjectId(objectId string) bool {
	return objectId != ""
}

func (s *sqlStorage) Create(ctx context.Context, orgId int64, ct string, objectId string, userId int64, content string) (*commentmodel.Comment, error) {
	if !checkContentType(ct) {
		return nil, errUnknownContentType
	}
	if !checkObjectId(objectId) {
		return nil, errEmptyObjectId
	}
	if content == "" {
		return nil, errEmptyContent
	}

	var result *commentmodel.Comment

	return result, s.sql.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		group := commentmodel.CommentGroup{
			OrgId:       orgId,
			ContentType: ct,
			ObjectId:    objectId,
		}
		has, err := dbSession.Get(&group)
		if err != nil {
			return err
		}

		nowUnix := time.Now().Unix()

		groupId := group.Id
		if !has {
			group.Created = nowUnix
			group.Updated = nowUnix
			group.Settings = commentmodel.Settings{}
			_, err = dbSession.Insert(&group)
			if err != nil {
				return err
			}
			groupId = group.Id
		}
		message := commentmodel.Comment{
			GroupId: groupId,
			UserId:  userId,
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

func (s *sqlStorage) Get(ctx context.Context, orgId int64, ct string, objectId string, _ GetFilter) ([]*commentmodel.Comment, error) {
	if !checkContentType(ct) {
		return nil, errUnknownContentType
	}
	if !checkObjectId(objectId) {
		return nil, errEmptyObjectId
	}

	var result []*commentmodel.Comment

	return result, s.sql.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		group := commentmodel.CommentGroup{
			OrgId:       orgId,
			ContentType: ct,
			ObjectId:    objectId,
		}
		has, err := dbSession.Get(&group)
		if err != nil {
			return err
		}
		if !has {
			return nil
		}
		return dbSession.Where("group_id=?", group.Id).OrderBy("id desc").Limit(100).Find(&result)
	})
}
