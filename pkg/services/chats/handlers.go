package chats

import "context"

type GetMessagesCmd struct {
}

type SendMessageCmd struct {
}

func (s *Service) GetMessages(ctx context.Context, cmd GetMessagesCmd) ([]Message, error) {
	return nil, nil
}

func (s *Service) SendMessage(ctx context.Context, cmd SendMessageCmd) (Message, error) {
	return Message{}, nil
}
