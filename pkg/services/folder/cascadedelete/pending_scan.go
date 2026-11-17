package cascadedelete

import (
	"context"
	"fmt"
	"strings"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	pending "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/cache"
)

const pendingQueuePrefix = "pending/"
const PendingScanPeriod = 5 * time.Minute
const pendingCaptureTimeout = 5 * time.Second
const pendingReconcileTimeout = 30 * time.Second

type ControllerOption func(*Controller)

func WithPendingRecovery(store PendingStore) ControllerOption {
	return func(c *Controller) {
		c.pending = store
	}
}

func (c *Controller) scanPending(ctx context.Context) error {
	continuation := ""
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		page, err := c.pending.List(ctx, "", continuation)
		if err != nil {
			return err
		}
		for _, entry := range page.Items {
			c.queue.Add(pendingQueuePrefix + entry.Namespace + "/" + entry.Name)
		}
		continuation = page.Continue
		if continuation == "" {
			return nil
		}
	}
}

func (c *Controller) runPendingScan(ctx context.Context) {
	ticker := time.NewTicker(PendingScanPeriod)
	defer ticker.Stop()
	for {
		if err := c.scanPending(ctx); err != nil && ctx.Err() == nil {
			logging.FromContext(ctx).Error("Folder pending deletion scan failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (c *Controller) reconcilePending(ctx context.Context, key string) error {
	ctx, cancel := context.WithTimeout(ctx, pendingReconcileTimeout)
	defer cancel()
	namespace, name, err := cache.SplitMetaNamespaceKey(strings.TrimPrefix(key, pendingQueuePrefix))
	if err != nil || namespace == "" || name == "" {
		logging.FromContext(ctx).Error("Folder pending deletion: invalid key", "key", key, "error", err)
		return nil
	}
	ns, _ := authlib.ParseNamespace(namespace)
	if ns.OrgID < 1 {
		logging.FromContext(ctx).Error("Folder pending deletion: namespace has no org", "namespace", namespace, "key", key)
		return nil
	}
	ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID)
	entry, err := c.pending.Get(ctx, namespace, name)
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	f, err := c.folders.Get(ctx, namespace, entry.Spec.FolderName)
	if apierrors.IsNotFound(err) || (err == nil && string(f.UID) != entry.Spec.FolderUID) {
		err = c.pending.Remove(ctx, entry)
		if apierrors.IsNotFound(err) {
			return nil
		}
		return err
	}
	if err != nil {
		return err
	}
	if f.DeletionTimestamp == nil {
		// Queued storage writes can commit after request timeout, so age cannot prove an intent is abandoned.
		return nil
	}
	// Timestamp capture is optional and must not hold cascade work behind a stalled storage call.
	if err := withPendingCaptureBudget(ctx, func(ctx context.Context) error {
		return c.pending.Capture(ctx, entry, *f.DeletionTimestamp)
	}); err != nil {
		logging.FromContext(ctx).Warn("Folder pending deletion timestamp capture failed", "namespace", namespace, "folder", f.Name, "error", err)
	}
	c.queue.Add(namespace + "/" + f.Name)
	return nil
}

func (c *Controller) capturePending(ctx context.Context, f *foldersv1.Folder) error {
	if c.pending == nil || f.DeletionTimestamp == nil {
		return nil
	}
	// The lookup and write share one budget so optional bookkeeping cannot stall the cascade.
	return withPendingCaptureBudget(ctx, func(ctx context.Context) error {
		entry, err := c.pending.Get(ctx, f.Namespace, pending.PendingDeletionName(f.Name, string(f.UID)))
		if apierrors.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if entry.Spec.FolderUID != string(f.UID) || entry.Spec.FolderName != f.Name {
			return fmt.Errorf("pending deletion identity mismatch for %s/%s", f.Namespace, f.Name)
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		return c.pending.Capture(ctx, entry, *f.DeletionTimestamp)
	})
}

func withPendingCaptureBudget(ctx context.Context, capture func(context.Context) error) error {
	ctx, cancel := context.WithTimeout(ctx, pendingCaptureTimeout)
	defer cancel()
	// Some stores ignore cancellation; a late result must not hold the worker or its sender.
	done := make(chan error, 1)
	go func() { done <- capture(ctx) }()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
