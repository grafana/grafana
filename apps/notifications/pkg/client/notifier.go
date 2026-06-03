package client

import (
	"context"

	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
)

// Notifier is the interface used by the comments team to create and delete notifications.
type Notifier interface {
	// Create persists a new notification.
	Create(ctx context.Context, n *notificationsv0alpha1.Notification) error

	// DeleteForComment removes all notifications whose source.commentUID matches commentUID.
	DeleteForComment(ctx context.Context, orgID int64, commentUID string) error
}
