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

func (s *sqlStorage) CreateMessage(ctx context.Context, orgId int64, ctId int, objectId string, userId *int64, content string) (*Message, error) {
	if !checkContentType(ctId) {
		return nil, errUnknownContentType
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

		var chatId int64
		if !has {
			chat.Created = nowUnix
			chat.Updated = nowUnix
			chatId, err = dbSession.Insert(chat)
			if err != nil {
				return err
			}
		}
		message := Message{
			ChatId:  chatId,
			UserId:  userId,
			Content: content,
			Created: nowUnix,
			Updated: nowUnix,
		}
		messageId, err := dbSession.Insert(message)
		if err != nil {
			return err
		}
		message.Id = messageId
		result = &message
		return nil
	})
}

func (s *sqlStorage) GetMessages(ctx context.Context, orgId int64, ctId int, objectId string, _ GetMessagesFilter) ([]*Message, error) {
	if !checkContentType(ctId) {
		return nil, errUnknownContentType
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
		return dbSession.Where("chat_id=?", chat.Id).Find(&result)
	})
}
