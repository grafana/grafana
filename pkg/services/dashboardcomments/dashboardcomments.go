package dashboardcomments

import "context"

type Service interface {
	ListThreads(ctx context.Context, q *ListThreadsQuery) ([]*Thread, error)
	CreateThread(ctx context.Context, cmd *CreateThreadCommand) (*Thread, error)
	UpdateThread(ctx context.Context, cmd *UpdateThreadCommand) (*Thread, error)
	DeleteThread(ctx context.Context, cmd *DeleteThreadCommand) error
	AddMessage(ctx context.Context, cmd *AddMessageCommand) (*Message, error)
	DeleteMessage(ctx context.Context, cmd *DeleteMessageCommand) error
}
