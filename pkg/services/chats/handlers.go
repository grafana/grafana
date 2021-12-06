package chats

import (
	"context"
	"encoding/json"
	"fmt"
)

type GetMessagesCmd struct {
	ContentTypeId int    `json:"contentTypeId"`
	ObjectId      string `json:"objectId"`
}

type SendMessageCmd struct {
	ContentTypeId int    `json:"contentTypeId"`
	ObjectId      string `json:"objectId"`
	Content       string `json:"content"`
}

func (s *Service) SendMessage(ctx context.Context, orgId int64, userId int64, cmd SendMessageCmd) (*Message, error) {
	// TODO: check user access to chat.
	m, err := s.storage.CreateMessage(ctx, orgId, cmd.ContentTypeId, cmd.ObjectId, userId, cmd.Content)
	if err != nil {
		return nil, err
	}
	e := ChatEvent{
		Event: ChatEventMessageCreated,
		MessageCreated: &EventMessageCreated{
			Id:      m.Id,
			Content: m.Content,
			UserId:  m.UserId,
			Created: m.Created,
		},
	}
	eventJSON, _ := json.Marshal(e)
	_ = s.live.Publish(orgId, fmt.Sprintf("grafana/chat/%d/%s", cmd.ContentTypeId, cmd.ObjectId), eventJSON)
	return m, nil
}

func (s *Service) GetMessages(ctx context.Context, orgId int64, _ int64, cmd GetMessagesCmd) ([]*Message, error) {
	// TODO: check user access to chat.
	return s.storage.GetMessages(ctx, orgId, cmd.ContentTypeId, cmd.ObjectId, GetMessagesFilter{})
}
