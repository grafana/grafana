package chats

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type sqlStorage struct {
	sql *sqlstore.SQLStore
}

func checkContentType(contentTypeId int) bool {
	_, ok := registeredContentTypes[contentTypeId]
	return ok
}

func checkObjectId(objectId string) bool {
	return objectId != ""
}

func (s *sqlStorage) CreateMessage(ctx context.Context, orgId int64, ctId int, objectId string, userId int64, content string) (*Message, error) {
	if !checkContentType(ctId) {
		return nil, errUnknownContentType
	}
	if !checkObjectId(objectId) {
		return nil, errEmptyObjectId
	}
	if content == "" {
		return nil, errEmptyContent
	}

	var result *Message

	return result, s.sql.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		chat := Chat{
			OrgId:         orgId,
			ContentTypeId: ctId,
			ObjectId:      objectId,
		}
		has, err := dbSession.Get(&chat)
		if err != nil {
			return err
		}

		nowUnix := time.Now().Unix()

		chatId := chat.Id
		if !has {
			chat.Created = nowUnix
			chat.Updated = nowUnix
			_, err = dbSession.Insert(&chat)
			if err != nil {
				return err
			}
			chatId = chat.Id
		}
		message := Message{
			ChatId:  chatId,
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

func (s *sqlStorage) GetMessages(ctx context.Context, orgId int64, ctId int, objectId string, _ GetMessagesFilter) ([]*Message, error) {
	if !checkContentType(ctId) {
		return nil, errUnknownContentType
	}
	if !checkObjectId(objectId) {
		return nil, errEmptyObjectId
	}

	var result []*Message

	return result, s.sql.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		chat := Chat{
			OrgId:         orgId,
			ContentTypeId: ctId,
			ObjectId:      objectId,
		}
		has, err := dbSession.Get(&chat)
		if err != nil {
			return err
		}
		if !has {
			return nil
		}
		return dbSession.Where("chat_id=?", chat.Id).OrderBy("id desc").Limit(100).Find(&result)
	})
}
