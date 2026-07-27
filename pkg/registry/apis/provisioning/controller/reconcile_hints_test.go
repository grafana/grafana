package controller

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/util/workqueue"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

type fakeRepoGetter struct {
	obj *provisioning.Repository
	err error
}

func (f fakeRepoGetter) Get(context.Context, string, string) (*provisioning.Repository, error) {
	return f.obj, f.err
}
func (f fakeRepoGetter) List(context.Context, string) ([]*provisioning.Repository, error) {
	return nil, nil
}

type fakeConnGetter struct {
	obj *provisioning.Connection
	err error
}

func (f fakeConnGetter) Get(context.Context, string, string) (*provisioning.Connection, error) {
	return f.obj, f.err
}

func notFound(name string) error {
	return apierrors.NewNotFound(schema.GroupResource{Resource: "repositories"}, name)
}

func TestHintFromObject(t *testing.T) {
	t.Run("reads uid, generation and operation from a delete stub", func(t *testing.T) {
		h := hintFromObject(&provisioning.Repository{ObjectMeta: metav1.ObjectMeta{
			UID:        "u1",
			Generation: 4,
			Annotations: map[string]string{
				usinformer.NotificationOperationAnnotation: usinformer.NotificationOperationDelete,
			},
		}})
		assert.Equal(t, "u1", h.uid)
		assert.Equal(t, int64(4), h.generation)
		assert.Equal(t, usinformer.NotificationOperationDelete, h.operation)
	})

	t.Run("defaults to upsert when no operation annotation is present", func(t *testing.T) {
		h := hintFromObject(&provisioning.Repository{ObjectMeta: metav1.ObjectMeta{UID: "u2"}})
		assert.Equal(t, usinformer.NotificationOperationUpsert, h.operation)
	})
}

// The reconcile read is classified against the notification hint: an upsert that
// 404s is a read-after-write race (retry), a delete that 404s is a no-op, a UID
// mismatch is a stale event for a previous object lifetime (ignore), and a
// fetched object older than the event's generation is stale (retry).
func TestRepositoryController_process_classifiesReconcileRead(t *testing.T) {
	const key = "ns1/repo1"

	tests := []struct {
		name    string
		getter  fakeRepoGetter
		hint    reconcileHint
		wantErr error // nil, or errObjectNotYetVisible
	}{
		{
			name:    "upsert notification, object not visible yet -> retry",
			getter:  fakeRepoGetter{err: notFound("repo1")},
			hint:    reconcileHint{operation: usinformer.NotificationOperationUpsert},
			wantErr: errObjectNotYetVisible,
		},
		{
			name:    "delete notification, object already gone -> no-op",
			getter:  fakeRepoGetter{err: notFound("repo1")},
			hint:    reconcileHint{operation: usinformer.NotificationOperationDelete},
			wantErr: nil,
		},
		{
			name: "stale event, UID differs from live object -> ignore",
			getter: fakeRepoGetter{obj: &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns1", Name: "repo1", UID: "current",
			}}},
			hint:    reconcileHint{operation: usinformer.NotificationOperationUpsert, uid: "previous"},
			wantErr: nil,
		},
		{
			name: "fetched object older than event generation -> retry",
			getter: fakeRepoGetter{obj: &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns1", Name: "repo1", UID: "u", Generation: 2,
			}}},
			hint:    reconcileHint{operation: usinformer.NotificationOperationUpsert, uid: "u", generation: 5},
			wantErr: errObjectNotYetVisible,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rc := &RepositoryController{repos: tt.getter, logger: logging.DefaultLogger}
			rc.hints.Store(key, tt.hint)

			err := rc.process(key)

			if tt.wantErr == nil {
				assert.NoError(t, err)
				return
			}
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}
}

// A not-yet-visible reconcile is retried a bounded number of times (once per
// backoff entry) and then dropped, rather than retried forever or dropped on the
// first miss.
func TestRepositoryController_processNextWorkItem_boundedVisibilityRetry(t *testing.T) {
	const key = "ns1/repo1"
	rc := &RepositoryController{
		logger:            logging.DefaultLogger,
		visibilityBackoff: []time.Duration{time.Millisecond, time.Millisecond},
		queue: workqueue.NewTypedRateLimitingQueue(
			workqueue.DefaultTypedControllerRateLimiter[string](),
		),
	}
	calls := 0
	rc.processFn = func(string) error {
		calls++
		return errObjectNotYetVisible
	}

	rc.queue.Add(key)
	// Initial attempt + one retry per backoff entry, then the key is forgotten and
	// the queue drains. Each processNextWorkItem blocks on the pending AddAfter.
	for i := 0; i < len(rc.visibilityBackoff)+1; i++ {
		rc.processNextWorkItem(context.Background())
	}

	assert.Equal(t, len(rc.visibilityBackoff)+1, calls)
	assert.Equal(t, 0, rc.queue.Len())
	_, ok := rc.visibilityAttempts.Load(key)
	assert.False(t, ok, "visibility attempts should be cleared once the key is forgotten")
}

func TestConnectionController_process_classifiesReconcileRead(t *testing.T) {
	tests := []struct {
		name    string
		getter  fakeConnGetter
		hint    reconcileHint
		wantErr error
	}{
		{
			name:    "upsert notification, object not visible yet -> retry",
			getter:  fakeConnGetter{err: apierrors.NewNotFound(schema.GroupResource{Resource: "connections"}, "conn1")},
			hint:    reconcileHint{operation: usinformer.NotificationOperationUpsert},
			wantErr: errObjectNotYetVisible,
		},
		{
			name:    "delete notification, object already gone -> no-op",
			getter:  fakeConnGetter{err: apierrors.NewNotFound(schema.GroupResource{Resource: "connections"}, "conn1")},
			hint:    reconcileHint{operation: usinformer.NotificationOperationDelete},
			wantErr: nil,
		},
		{
			name: "stale event, UID differs from live object -> ignore",
			getter: fakeConnGetter{obj: &provisioning.Connection{ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns1", Name: "conn1", UID: "current",
			}}},
			hint:    reconcileHint{operation: usinformer.NotificationOperationUpsert, uid: "previous"},
			wantErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cc := &ConnectionController{conns: tt.getter, logger: logging.DefaultLogger}
			item := &connectionQueueItem{key: "ns1/conn1", hint: tt.hint}

			err := cc.process(context.Background(), item)

			if tt.wantErr == nil {
				assert.NoError(t, err)
				return
			}
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}
}

// visibilityRetryDelay caps the number of retries at the backoff length.
func TestVisibilityRetryDelay(t *testing.T) {
	backoff := []time.Duration{10 * time.Millisecond, 20 * time.Millisecond}
	for attempt := 0; attempt < len(backoff); attempt++ {
		d, ok := visibilityRetryDelay(backoff, attempt)
		require.True(t, ok)
		assert.GreaterOrEqual(t, d, backoff[attempt])
	}
	_, ok := visibilityRetryDelay(backoff, len(backoff))
	assert.False(t, ok)
	_, ok = visibilityRetryDelay(backoff, -1)
	assert.False(t, ok)
}
