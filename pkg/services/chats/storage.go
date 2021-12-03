package chats

import (
	"context"
	"errors"
)

type GetMessagesFilter struct {
}

const (
	ContentTypeUser      = 1
	ContentTypeDashboard = 2
)

var registeredContentTypes = map[int]struct{}{
	ContentTypeUser:      {},
	ContentTypeDashboard: {},
}

var (
	errUnknownContentType = errors.New("unknown content type")
)

type Storage interface {
	CreateMessage(ctx context.Context, orgId int64, ctId int, objectId string, userId *int64, content string) (*Message, error)
	GetMessages(ctx context.Context, orgId int64, ctId int, objectId string, filter GetMessagesFilter) ([]*Message, error)
}
