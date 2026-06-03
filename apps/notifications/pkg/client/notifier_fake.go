package client

import (
	"context"
	"sync"

	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
)

// FakeNotifier is an in-memory Notifier for use in tests.
// It records every call but takes no real action.
type FakeNotifier struct {
	mu                 sync.Mutex
	Created            []*notificationsv0alpha1.Notification
	DeletedCommentUIDs []string
}

// Create records n in Created.
func (f *FakeNotifier) Create(_ context.Context, n *notificationsv0alpha1.Notification) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Created = append(f.Created, n)
	return nil
}

// DeleteForComment records commentUID in DeletedCommentUIDs.
func (f *FakeNotifier) DeleteForComment(_ context.Context, _ int64, commentUID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.DeletedCommentUIDs = append(f.DeletedCommentUIDs, commentUID)
	return nil
}

// Compile-time interface compliance check.
var _ Notifier = (*FakeNotifier)(nil)
