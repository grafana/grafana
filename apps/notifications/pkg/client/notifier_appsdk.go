package client

import (
	"context"
	"fmt"
	"sync"

	authlibTypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
)

// AppSDKNotifier implements Notifier using the generated App-SDK client.
type AppSDKNotifier struct {
	// direct client path (NewAppSDKNotifier)
	client *notificationsv0alpha1.NotificationClient

	// lazy generator path (NewAppSDKNotifierFromGenerator)
	// ClientFor on the generator blocks until the API server is ready, so we
	// must not call it during Wire initialization — only on first actual use.
	generator resource.ClientGenerator
	once      sync.Once
	initErr   error
}

// NewAppSDKNotifier creates an AppSDKNotifier backed by the given resource.Client.
func NewAppSDKNotifier(c resource.Client) *AppSDKNotifier {
	return &AppSDKNotifier{
		client: notificationsv0alpha1.NewNotificationClient(c),
	}
}

// NewAppSDKNotifierFromGenerator creates an AppSDKNotifier that initializes its
// underlying client lazily on first use. The generator must not be called during
// Wire initialization because restConfigProvider.GetRestConfig blocks until the
// API server is ready, causing a deadlock.
func NewAppSDKNotifierFromGenerator(gen resource.ClientGenerator) (*AppSDKNotifier, error) {
	return &AppSDKNotifier{generator: gen}, nil
}

func (a *AppSDKNotifier) getClient() (*notificationsv0alpha1.NotificationClient, error) {
	if a.client != nil {
		return a.client, nil
	}
	a.once.Do(func() {
		c, err := notificationsv0alpha1.NewNotificationClientFromGenerator(a.generator)
		if err != nil {
			a.initErr = err
			return
		}
		a.client = c
	})
	return a.client, a.initErr
}

// Create persists a new notification. The namespace is derived from n.Spec.OrgID.
func (a *AppSDKNotifier) Create(ctx context.Context, n *notificationsv0alpha1.Notification) error {
	client, err := a.getClient()
	if err != nil {
		return err
	}
	ns := authlibTypes.OrgNamespaceFormatter(n.Spec.OrgID)
	n.Namespace = ns
	_, err = client.Create(ctx, n, resource.CreateOptions{})
	return err
}

// DeleteForComment deletes all notifications whose source.commentUID equals commentUID.
func (a *AppSDKNotifier) DeleteForComment(ctx context.Context, orgID int64, commentUID string) error {
	client, err := a.getClient()
	if err != nil {
		return err
	}
	ns := authlibTypes.OrgNamespaceFormatter(orgID)
	list, err := client.ListAll(ctx, ns, resource.ListOptions{
		FieldSelectors: []string{fmt.Sprintf("spec.source.commentUID=%s", commentUID)},
	})
	if err != nil {
		return err
	}
	for _, n := range list.Items {
		if err := client.Delete(ctx, resource.Identifier{
			Namespace: n.Namespace,
			Name:      n.Name,
		}, resource.DeleteOptions{}); err != nil {
			return err
		}
	}
	return nil
}

// Compile-time interface compliance check.
var _ Notifier = (*AppSDKNotifier)(nil)
