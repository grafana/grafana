package dashboardcomments

import "context"

type store interface {
	ListThreads(ctx context.Context, orgID int64, dashboardUID string) ([]*Thread, error)
	GetThread(ctx context.Context, orgID, threadID int64) (*Thread, error)
	InsertThread(ctx context.Context, thread *Thread, firstMessage *Message) (*Thread, error)
	UpdateThread(ctx context.Context, thread *Thread) error
	DeleteThread(ctx context.Context, orgID, threadID int64) error
	InsertMessage(ctx context.Context, msg *Message) (*Message, error)
	GetMessage(ctx context.Context, messageID int64) (*Message, error)
	DeleteMessage(ctx context.Context, messageID int64) error
}
