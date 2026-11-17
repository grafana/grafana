package cascadedelete

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hashicorp/golang-lru/v2/simplelru"

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
const pendingScanPageTimeout = 30 * time.Second
const missingIntentCapacity = 1024

var errPendingEntryMissing = errors.New("pending deletion entry missing")

type missingIntentObservation struct {
	uid      string
	reported bool
}

func (c *Controller) beginMissingObservation(key, uid string) *missingIntentObservation {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.queue.ShuttingDown() {
		return nil
	}
	if c.missingIntents == nil {
		c.missingIntents, _ = simplelru.NewLRU[string, *missingIntentObservation](missingIntentCapacity, nil)
	}
	if current, ok := c.missingIntents.Get(key); ok && current.uid == uid {
		return current
	}
	observation := &missingIntentObservation{uid: uid}
	c.missingIntents.Add(key, observation)
	return observation
}

func (c *Controller) invalidateMissing(key, uid string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.invalidateMissingLocked(key, uid)
}

func (c *Controller) invalidateMissingLocked(key, uid string) {
	if c.missingIntents == nil {
		return
	}
	if current, ok := c.missingIntents.Peek(key); ok && (uid == "" || current.uid != uid) {
		c.missingIntents.Remove(key)
	}
}

func (c *Controller) claimMissingObservation(ctx context.Context, f *foldersv1.Folder, observation *missingIntentObservation) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if ctx.Err() != nil || c.queue.ShuttingDown() || observation == nil || c.missingIntents == nil {
		return false
	}
	// A delete, replacement or eviction must invalidate an in-flight lookup, not recreate its slot.
	current, ok := c.missingIntents.Peek(f.Namespace + "/" + f.Name)
	if !ok || current != observation || current.reported {
		return false
	}
	current.reported = true
	return true
}

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
		pageCtx, cancel := context.WithTimeout(ctx, pendingScanPageTimeout)
		page, err := c.pending.List(pageCtx, "", continuation)
		cancel()
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
	if apierrors.IsNotFound(err) {
		c.invalidateMissing(namespace+"/"+entry.Spec.FolderName, "")
	} else if err == nil {
		c.invalidateMissing(namespace+"/"+entry.Spec.FolderName, string(f.UID))
	}
	if apierrors.IsNotFound(err) || (err == nil && string(f.UID) != entry.Spec.FolderUID) {
		// Observation is best effort: a crash or conditional cleanup retry may lose or duplicate a sample.
		c.pendingMetrics.completed(entry)
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
	// Lookup, capture and reporting share one budget, including any blocked logger.
	ctx, cancel := context.WithTimeout(ctx, pendingCaptureTimeout)
	defer cancel()
	observation := c.beginMissingObservation(f.Namespace+"/"+f.Name, string(f.UID))
	err := withPendingCaptureBudget(ctx, func(ctx context.Context) error {
		entry, err := c.pending.Get(ctx, f.Namespace, pending.PendingDeletionName(f.Name, string(f.UID)))
		if apierrors.IsNotFound(err) {
			return errPendingEntryMissing
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
	if errors.Is(err, errPendingEntryMissing) {
		if !c.claimMissingObservation(ctx, f, observation) {
			return nil
		}
		return withPendingCaptureBudget(ctx, func(ctx context.Context) error {
			if err := ctx.Err(); err != nil {
				return err
			}
			if c.pendingMetrics != nil {
				c.pendingMetrics.missing.Inc()
			}
			logging.FromContext(ctx).Error("Terminating folder has no pending deletion entry", "namespace", f.Namespace, "folder", f.Name)
			return nil
		})
	}
	return err
}

func withPendingCaptureBudget(ctx context.Context, capture func(context.Context) error) error {
	ctx, cancel := context.WithTimeout(ctx, pendingCaptureTimeout)
	defer cancel()
	// Some stores ignore cancellation; a late result must not hold the worker or its sender.
	done := make(chan error, 1)
	go func() { done <- capture(ctx) }()
	select {
	case err := <-done:
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
