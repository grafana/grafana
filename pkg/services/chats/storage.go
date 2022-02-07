package chats

import (
	"context"
	"errors"
)

type GetMessagesFilter struct{}

const (
	ContentTypeOrg        = 1
	ContentTypeDashboard  = 2
	ContentTypeAnnotation = 3
)

var registeredContentTypes = map[int]struct{}{
	ContentTypeOrg:        {},
	ContentTypeDashboard:  {},
	ContentTypeAnnotation: {},
}

var (
	errUnknownContentType = errors.New("unknown content type")
	errEmptyObjectId      = errors.New("empty object id")
	errEmptyContent       = errors.New("empty message content")
)

type Storage interface {
	CreateMessage(ctx context.Context, orgId int64, ctId int, objectId string, userId int64, content string) (*Message, error)
	GetMessages(ctx context.Context, orgId int64, ctId int, objectId string, filter GetMessagesFilter) ([]*Message, error)
}
