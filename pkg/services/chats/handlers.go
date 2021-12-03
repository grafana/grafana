package chats

import "context"

type GetMessagesCmd struct {
	ContentTypeId int    `json:"content_type_id"`
	ObjectId      string `json:"object_id"`
}

type SendMessageCmd struct {
	ContentTypeId int    `json:"content_type_id"`
	ObjectId      string `json:"object_id"`
	Content       string `json:"content"`
	System        bool   `json:"system"`
}

func (s *Service) SendMessage(ctx context.Context, orgId int64, userId int64, cmd SendMessageCmd) (*Message, error) {
	// TODO: check user access to chat.
	return s.storage.CreateMessage(ctx, orgId, cmd.ContentTypeId, cmd.ObjectId, userId, cmd.Content)
}

func (s *Service) GetMessages(ctx context.Context, orgId int64, _ int64, cmd GetMessagesCmd) ([]*Message, error) {
	// TODO: check user access to chat.
	return s.storage.GetMessages(ctx, orgId, cmd.ContentTypeId, cmd.ObjectId, GetMessagesFilter{})
}
