package chats

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/chats/chatmodel"
)

type GetMessagesFilter struct{}

var (
	errUnknownContentType = errors.New("unknown content type")
	errEmptyObjectId      = errors.New("empty object id")
	errEmptyContent       = errors.New("empty message content")
)

type Storage interface {
	CreateMessage(ctx context.Context, orgId int64, ctId int, objectId string, userId int64, content string) (*chatmodel.Message, error)
	GetMessages(ctx context.Context, orgId int64, ctId int, objectId string, filter GetMessagesFilter) ([]*chatmodel.Message, error)
}
