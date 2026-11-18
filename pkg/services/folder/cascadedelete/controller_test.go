package cascadedelete

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	k8stesting "k8s.io/client-go/testing"
	"k8s.io/client-go/tools/cache"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	pendingv1alpha1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// startController runs a controller against m inside the current synctest bubble, with m delivering
// folder events to it as the informer would. The returned stop must be called before the bubble ends.
func startController(t *testing.T, m *memStore, batch int) (*Controller, func()) {
	t.Helper()
	c := NewController(m, newTestReconciler(m, batch), nil)
	m.mu.Lock()
	m.handler = c.Handler()
	m.mu.Unlock()
	return c, run(c)
}

func run(c *Controller) func() {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		c.Run(ctx, 1)
	}()
	return func() {
		cancel()
		<-done
	}
}

func folderObj(name string) *foldersv1.Folder {
	return &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name}}
}

func pendingObject(name, uid string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "folder.grafana.app/v1alpha1", "kind": "PendingFolderDeletion",
		"metadata": map[string]any{"name": pendingv1alpha1.PendingDeletionName(name, uid), "namespace": testNamespace, "uid": "entry-" + name, "resourceVersion": "7"},
		"spec":     map[string]any{"folderName": name, "folderUID": uid},
	}}
}

func TestController_PendingStartupRecovery(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("unrelated", "")
		m.userDelete("a")
		pending := NewPendingClient(newFake(pendingObject("a", "a-uid")))
		c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(pending))
		initial := folderObj("a")
		initial.ResourceVersion = "7"
		c.Handler().OnAdd(initial, true)
		stop := run(c)
		defer stop()
		synctest.Wait()
		require.False(t, m.exists("a"))
		require.Zero(t, m.getCount("unrelated"))
		entry, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.NoError(t, err)
		require.NotNil(t, entry.Spec.DeletionTimestamp)
		time.Sleep(5 * time.Minute)
		synctest.Wait()
		_, err = pending.Get(context.Background(), testNamespace, entry.Name)
		require.True(t, apierrors.IsNotFound(err))
	})
}

func TestController_PendingRetainsAmbiguousAndCleansOldIdentity(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("replacement", "")
		old := pendingObject("replacement", "old-uid")
		require.NoError(t, unstructured.SetNestedField(old.Object, "invalid-timestamp", "spec", "deletionTimestamp"))
		pending := NewPendingClient(newFake(pendingObject("a", "a-uid"), old))
		c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(pending))
		stop := run(c)
		defer stop()
		synctest.Wait()
		time.Sleep(15 * time.Minute)
		synctest.Wait()
		_, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.NoError(t, err)
		_, err = pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("replacement", "old-uid"))
		require.True(t, apierrors.IsNotFound(err))
		require.True(t, m.exists("replacement"))
		require.Nil(t, m.get("replacement").DeletionTimestamp)
		m.userDelete("a") // No event handler: recovery must find this later write.
		time.Sleep(5 * time.Minute)
		synctest.Wait()
		require.False(t, m.exists("a"))
	})
}

func TestController_PendingMissingDoesNotBlockOrRepair(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		pending := NewPendingClient(newFake())
		c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(pending))
		m.handler = c.Handler()
		stop := run(c)
		defer stop()
		m.userDelete("a")
		synctest.Wait()
		require.False(t, m.exists("a"))
		page, err := pending.List(context.Background(), "", "")
		require.NoError(t, err)
		require.Empty(t, page.Items)
	})
}

func TestController_PendingKeepsEntryWhileOtherFinalizerHoldsFolder(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer, otherFinalizer)
		m.userDelete("a")
		pending := NewPendingClient(newFake(pendingObject("a", "a-uid")))
		c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(pending))
		stop := run(c)
		defer func() { stop() }()
		synctest.Wait()
		require.Equal(t, []string{otherFinalizer}, m.get("a").Finalizers)
		stop()
		c = NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(pending))
		stop = run(c)
		synctest.Wait()
		time.Sleep(5 * time.Minute)
		synctest.Wait()
		entry, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.NoError(t, err)
		require.NotNil(t, entry.Spec.DeletionTimestamp)
		m.mu.Lock()
		delete(m.folders, "a")
		m.mu.Unlock()
		time.Sleep(5 * time.Minute)
		synctest.Wait()
		_, err = pending.Get(context.Background(), testNamespace, entry.Name)
		require.True(t, apierrors.IsNotFound(err))
	})
}

type pagedPendingStore struct {
	PendingStore
	list func(context.Context, string, string) (*pendingv1alpha1.PendingFolderDeletionList, error)
}

func (p pagedPendingStore) List(ctx context.Context, namespace, continuation string) (*pendingv1alpha1.PendingFolderDeletionList, error) {
	return p.list(ctx, namespace, continuation)
}

func TestController_PendingCaptureFailureDoesNotBlockDeletion(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.userDelete("a")
		fake := newFake(pendingObject("a", "a-uid"))
		fake.PrependReactor("update", "pendingfolderdeletions", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("timestamp update unavailable")
		})
		pending := NewPendingClient(fake)
		c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(pending))
		stop := run(c)
		defer stop()
		synctest.Wait()
		require.False(t, m.exists("a"))
		_, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.NoError(t, err, "pending entry remains until completion is observed")
	})
}

type folderGetterFunc func(context.Context, string, string) (*foldersv1.Folder, error)

func (f folderGetterFunc) Get(ctx context.Context, namespace, name string) (*foldersv1.Folder, error) {
	return f(ctx, namespace, name)
}

type retryPendingStore struct {
	PendingStore
	remove func(context.Context, *pendingv1alpha1.PendingFolderDeletion) error
}

func (p retryPendingStore) Remove(ctx context.Context, entry *pendingv1alpha1.PendingFolderDeletion) error {
	return p.remove(ctx, entry)
}

func TestController_PendingAutomaticallyRetriesReadAndCleanup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		fake := newFake(pendingObject("a", "a-uid"))
		entryReads := 0
		fake.PrependReactor("get", "pendingfolderdeletions", func(k8stesting.Action) (bool, runtime.Object, error) {
			entryReads++
			if entryReads == 1 {
				return true, nil, errors.New("temporary entry read failure")
			}
			return false, nil, nil
		})
		pending := NewPendingClient(fake)
		reads, removals := 0, 0
		getter := folderGetterFunc(func(context.Context, string, string) (*foldersv1.Folder, error) {
			reads++
			if reads == 1 {
				return nil, errors.New("temporary folder read failure")
			}
			return nil, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), "a")
		})
		store := retryPendingStore{PendingStore: pending, remove: func(ctx context.Context, entry *pendingv1alpha1.PendingFolderDeletion) error {
			removals++
			if removals == 1 {
				return apierrors.NewConflict(pendingGVR.GroupResource(), entry.Name, errors.New("concurrent capture"))
			}
			if removals == 2 {
				return errors.New("temporary remove failure")
			}
			return pending.Remove(ctx, entry)
		}}
		c := NewController(getter, nil, nil, WithPendingRecovery(store))
		stop := run(c)
		defer stop()
		synctest.Wait()
		time.Sleep(time.Second)
		synctest.Wait()
		_, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.True(t, apierrors.IsNotFound(err))
		require.Equal(t, 4, reads)
		require.Equal(t, 3, removals)
	})
}

func TestController_PendingScanPageBudgets(t *testing.T) {
	for _, earlierDeadline := range []bool{false, true} {
		t.Run(fmt.Sprint(earlierDeadline), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := context.Background()
				if earlierDeadline {
					var cancel context.CancelFunc
					ctx, cancel = context.WithTimeout(ctx, 10*time.Second)
					defer cancel()
				}
				var pages []context.Context
				store := pagedPendingStore{list: func(ctx context.Context, namespace, continuation string) (*pendingv1alpha1.PendingFolderDeletionList, error) {
					require.Empty(t, namespace)
					if len(pages) > 0 {
						require.ErrorIs(t, pages[len(pages)-1].Err(), context.Canceled)
					}
					pages = append(pages, ctx)
					select {
					case <-ctx.Done():
						return nil, ctx.Err()
					case <-time.After(20 * time.Second):
					}
					if len(pages) == 1 {
						require.Empty(t, continuation)
						return &pendingv1alpha1.PendingFolderDeletionList{ListMeta: metav1.ListMeta{Continue: "next"}}, nil
					}
					require.Equal(t, "next", continuation)
					return &pendingv1alpha1.PendingFolderDeletionList{}, nil
				}}
				c := NewController(newMemStore(), nil, nil, WithPendingRecovery(store))
				defer c.ShutDown()
				start := time.Now()
				err := c.scanPending(ctx)
				if earlierDeadline {
					require.ErrorIs(t, err, context.DeadlineExceeded)
					require.Len(t, pages, 1)
					require.Equal(t, 10*time.Second, time.Since(start))
				} else {
					require.NoError(t, err)
					require.Len(t, pages, 2)
					require.Equal(t, 40*time.Second, time.Since(start))
					for _, page := range pages {
						require.ErrorIs(t, page.Err(), context.Canceled)
					}
				}
			})
		})
	}
}

func TestController_PendingRetriesFailedPageOnNextScan(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		objects := make([]runtime.Object, 0, 101)
		objects = append(objects, pendingObject("a", "a-uid"), pendingObject("b", "b-uid"))
		firstPage := make([]pendingv1alpha1.PendingFolderDeletion, 0, 100)
		firstPage = append(firstPage, pendingv1alpha1.PendingFolderDeletion{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: pendingv1alpha1.PendingDeletionName("a", "a-uid")}})
		for i := range 99 {
			obj := pendingObject(fmt.Sprintf("extra-%d", i), fmt.Sprintf("extra-%d-uid", i))
			objects = append(objects, obj)
			firstPage = append(firstPage, pendingv1alpha1.PendingFolderDeletion{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: obj.GetName()}})
		}
		pending := NewPendingClient(newFake(objects...))
		scans := 0
		var stalledPage context.Context
		store := pagedPendingStore{PendingStore: pending, list: func(ctx context.Context, namespace, continuation string) (*pendingv1alpha1.PendingFolderDeletionList, error) {
			require.Empty(t, namespace)
			if continuation == "" {
				scans++
				return &pendingv1alpha1.PendingFolderDeletionList{ListMeta: metav1.ListMeta{Continue: "next"}, Items: firstPage}, nil
			}
			require.Equal(t, "next", continuation)
			if scans == 1 {
				stalledPage = ctx
				<-ctx.Done()
				return nil, ctx.Err()
			}
			return &pendingv1alpha1.PendingFolderDeletionList{Items: []pendingv1alpha1.PendingFolderDeletion{{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: pendingv1alpha1.PendingDeletionName("b", "b-uid")}}}}, nil
		}}
		c := NewController(newMemStore(), nil, nil, WithPendingRecovery(store))
		stop := run(c)
		defer stop()
		synctest.Wait()
		_, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.True(t, apierrors.IsNotFound(err))
		_, err = pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("b", "b-uid"))
		require.NoError(t, err)
		remaining, err := pending.List(context.Background(), "", "")
		require.NoError(t, err)
		require.Len(t, remaining.Items, 1, "all 100 first-page entries must be processed despite the stalled next page")
		time.Sleep(30 * time.Second)
		synctest.Wait()
		require.NotNil(t, stalledPage)
		require.ErrorIs(t, stalledPage.Err(), context.DeadlineExceeded)
		require.Equal(t, 1, scans)
		time.Sleep(5*time.Minute - 30*time.Second)
		synctest.Wait()
		_, err = pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("b", "b-uid"))
		require.True(t, apierrors.IsNotFound(err))
		require.Equal(t, 2, scans)
		remaining, err = pending.List(context.Background(), "", "")
		require.NoError(t, err)
		require.Empty(t, remaining.Items)
	})
}

func TestController_PendingNamespaceIsolation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		a, b := pendingObject("a", "same-uid"), pendingObject("a", "same-uid")
		b.SetNamespace("org-2")
		pending := NewPendingClient(newFake(a, b))
		seen := map[string]int{}
		getter := folderGetterFunc(func(ctx context.Context, namespace, name string) (*foldersv1.Folder, error) {
			require.True(t, identity.IsServiceIdentity(ctx))
			requester, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			require.Equal(t, map[string]int64{"default": 1, "org-2": 2}[namespace], requester.GetOrgID())
			require.Equal(t, "a", name)
			seen[namespace]++
			return nil, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
		})
		c := NewController(getter, nil, nil, WithPendingRecovery(pending))
		stop := run(c)
		defer stop()
		synctest.Wait()
		require.Equal(t, map[string]int{"default": 1, "org-2": 1}, seen)
		page, err := pending.List(context.Background(), "", "")
		require.NoError(t, err)
		require.Empty(t, page.Items)
	})
}

func TestController_PendingOrdinaryReconcileCapture(t *testing.T) {
	for _, tc := range []struct {
		name        string
		terminating bool
		mismatch    bool
		readError   bool
	}{
		{name: "nonterminating"},
		{name: "terminating", terminating: true},
		{name: "identity mismatch", terminating: true, mismatch: true},
		{name: "read error", terminating: true, readError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				m := newMemStore()
				m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer, otherFinalizer)
				if tc.terminating {
					m.userDelete("a")
				}
				obj := pendingObject("a", "a-uid")
				if tc.mismatch {
					require.NoError(t, unstructured.SetNestedField(obj.Object, "different-folder", "spec", "folderName"))
				}
				fake := newFake(obj)
				if tc.readError {
					fake.PrependReactor("get", "pendingfolderdeletions", func(k8stesting.Action) (bool, runtime.Object, error) {
						return true, nil, errors.New("entry unavailable")
					})
				}
				c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(NewPendingClient(fake)))
				defer c.ShutDown()
				c.queue.Add(testNamespace + "/a")
				require.True(t, c.processNext(context.Background()))
				if tc.terminating {
					require.Equal(t, []string{otherFinalizer}, m.get("a").Finalizers)
				}
				if !tc.terminating {
					require.Empty(t, fake.Actions(), "nonterminating folders must not read pending entries")
				} else {
					action := fake.Actions()[0].(k8stesting.GetAction)
					require.Equal(t, "a-a-uid", action.GetName(), "look up the exact API name plus non-UUID Kubernetes incarnation UID")
					require.Equal(t, pendingv1alpha1.PendingFolderDeletionResourceInfo.GroupVersionResource(), action.GetResource())
				}
				stored, err := fake.Tracker().Get(pendingGVR, testNamespace, obj.GetName())
				require.NoError(t, err)
				stamp, found, err := unstructured.NestedString(stored.(*unstructured.Unstructured).Object, "spec", "deletionTimestamp")
				require.NoError(t, err)
				wantCapture := tc.terminating && !tc.mismatch && !tc.readError
				require.Equal(t, wantCapture, found)
				if wantCapture {
					require.Equal(t, m.get("a").DeletionTimestamp.UTC().Format(time.RFC3339Nano), stamp)
				}
			})
		})
	}
}

type stalledPendingStore struct {
	PendingStore
	get     func(context.Context, string, string) (*pendingv1alpha1.PendingFolderDeletion, error)
	capture func(context.Context, *pendingv1alpha1.PendingFolderDeletion, metav1.Time) error
}

func (p stalledPendingStore) Get(ctx context.Context, namespace, name string) (*pendingv1alpha1.PendingFolderDeletion, error) {
	return p.get(ctx, namespace, name)
}

func (p stalledPendingStore) Capture(ctx context.Context, entry *pendingv1alpha1.PendingFolderDeletion, stamp metav1.Time) error {
	return p.capture(ctx, entry, stamp)
}

func TestController_PendingStalledCaptureBudget(t *testing.T) {
	for _, path := range []string{"event get", "event capture", "scan capture", "event get ignores cancellation", "event capture ignores cancellation", "scan capture ignores cancellation"} {
		t.Run(path, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				m := newMemStore()
				m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
				m.userDelete("a")
				pending := NewPendingClient(newFake(pendingObject("a", "a-uid")))
				var stalledErr error
				release := make(chan struct{})
				defer close(release)
				stall := func(ctx context.Context) {
					<-ctx.Done()
					stalledErr = ctx.Err()
					if strings.HasSuffix(path, "ignores cancellation") {
						<-release
					}
				}
				captures := 0
				store := stalledPendingStore{PendingStore: pending}
				store.get = func(ctx context.Context, namespace, name string) (*pendingv1alpha1.PendingFolderDeletion, error) {
					if strings.HasPrefix(path, "event get") {
						stall(ctx)
						return nil, ctx.Err()
					}
					if strings.HasPrefix(path, "event capture") {
						time.Sleep(2 * time.Second)
					}
					return pending.Get(ctx, namespace, name)
				}
				store.capture = func(ctx context.Context, entry *pendingv1alpha1.PendingFolderDeletion, stamp metav1.Time) error {
					captures++
					if captures == 1 {
						stall(ctx)
						return ctx.Err()
					}
					return pending.Capture(ctx, entry, stamp)
				}
				c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(store))
				defer c.ShutDown()
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				key := testNamespace + "/a"
				if strings.HasPrefix(path, "scan capture") {
					key = pendingQueuePrefix + testNamespace + "/" + pendingv1alpha1.PendingDeletionName("a", "a-uid")
				}
				c.queue.Add(key)
				done := make(chan struct{})
				go func() {
					defer close(done)
					c.processNext(ctx)
				}()
				synctest.Wait()
				time.Sleep(5 * time.Second)
				synctest.Wait()
				select {
				case <-done:
				default:
					t.Fatal("optional pending work blocked the worker beyond five seconds")
				}
				require.ErrorIs(t, stalledErr, context.DeadlineExceeded)
				require.NoError(t, ctx.Err(), "optional timeout must not cancel cascade context")
				if strings.HasPrefix(path, "scan capture") {
					require.Equal(t, 1, c.queue.Len(), "capture timeout must still enqueue cascade")
					c.processNext(ctx)
				}
				require.False(t, m.exists("a"))
			})
		})
	}
}

func TestController_PendingReconcileTimeoutRetries(t *testing.T) {
	for _, tc := range []struct {
		name          string
		stall         string
		replacement   bool
		parentTimeout time.Duration
		cancelParent  bool
	}{
		{name: "pending get", stall: "pending get"},
		{name: "folder get shares budget", stall: "folder get"},
		{name: "remove missing folder shares budget", stall: "remove"},
		{name: "remove replacement shares budget", stall: "remove", replacement: true},
		{name: "earlier parent deadline", stall: "pending get", parentTimeout: 7 * time.Second},
		{name: "parent cancellation", stall: "pending get", cancelParent: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				m := newMemStore()
				if tc.replacement {
					m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
				}
				original := m.get("a")
				obj := pendingObject("a", "old-uid")
				pending := NewPendingClient(newFake(obj))
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				if tc.parentTimeout > 0 {
					var stop context.CancelFunc
					ctx, stop = context.WithTimeout(ctx, tc.parentTimeout)
					defer stop()
				}
				start := time.Now()
				var stallCtx, lastGetCtx context.Context
				var stalledErr error
				reads, folderReads, removes := 0, 0, 0
				stall := func(ctx context.Context) error {
					stallCtx = ctx
					<-ctx.Done()
					stalledErr = ctx.Err()
					return stalledErr
				}
				getStore := stalledPendingStore{PendingStore: pending, get: func(ctx context.Context, namespace, name string) (*pendingv1alpha1.PendingFolderDeletion, error) {
					reads++
					lastGetCtx = ctx
					if reads == 1 {
						if tc.stall == "pending get" {
							return nil, stall(ctx)
						}
						time.Sleep(10 * time.Second)
					}
					return pending.Get(ctx, namespace, name)
				}}
				store := retryPendingStore{PendingStore: getStore, remove: func(ctx context.Context, entry *pendingv1alpha1.PendingFolderDeletion) error {
					removes++
					if reads == 1 {
						return stall(ctx)
					}
					return pending.Remove(ctx, entry)
				}}
				getter := folderGetterFunc(func(ctx context.Context, namespace, name string) (*foldersv1.Folder, error) {
					folderReads++
					if reads == 1 {
						if tc.stall == "folder get" {
							return nil, stall(ctx)
						}
						time.Sleep(10 * time.Second)
					}
					return m.Get(ctx, namespace, name)
				})
				c := NewController(getter, nil, nil, WithPendingRecovery(store))
				defer c.ShutDown()
				key := pendingQueuePrefix + testNamespace + "/" + obj.GetName()
				c.queue.Add(key)
				done := make(chan struct{})
				go func() { defer close(done); c.processNext(ctx) }()
				synctest.Wait()
				elapsed := time.Duration(0)
				if tc.stall != "pending get" {
					elapsed = 10 * time.Second
					if tc.stall == "remove" {
						elapsed = 20 * time.Second
					}
					time.Sleep(elapsed)
					synctest.Wait()
				}
				require.NotNil(t, stallCtx)
				deadline, bounded := stallCtx.Deadline()
				require.True(t, bounded, "required pending work needs a deadline")
				budget := 30 * time.Second
				if tc.parentTimeout > 0 {
					budget = tc.parentTimeout
				}
				require.Equal(t, start.Add(budget), deadline, "all sequential calls share one deadline")
				_, err := pending.Get(context.Background(), testNamespace, obj.GetName())
				require.NoError(t, err, "no premature removal")
				if tc.stall == "pending get" {
					require.Zero(t, folderReads)
				}
				if tc.stall != "remove" {
					require.Zero(t, removes)
				}
				if tc.cancelParent {
					cancel()
				} else {
					time.Sleep(budget - elapsed)
				}
				synctest.Wait()
				select {
				case <-done:
				default:
					t.Fatal("required pending work did not return at its deadline")
				}
				if tc.cancelParent {
					require.ErrorIs(t, stalledErr, context.Canceled)
				} else {
					require.ErrorIs(t, stalledErr, context.DeadlineExceeded)
				}
				if tc.parentTimeout == 0 && !tc.cancelParent {
					require.NoError(t, ctx.Err(), "pending timeout must not cancel controller context")
				}
				require.Equal(t, 1, c.queue.NumRequeues(key), "deadline errors must rate-limit the same intent, not forget it")
				_, err = pending.Get(context.Background(), testNamespace, obj.GetName())
				require.NoError(t, err)
				require.Equal(t, original, m.get("a"), "never mutate a replacement")
				time.Sleep(5 * time.Millisecond)
				synctest.Wait()
				require.Equal(t, 1, c.queue.Len())
				require.True(t, c.processNext(context.Background()))
				require.Equal(t, 2, reads)
				require.Zero(t, c.queue.NumRequeues(key), "successful retry forgets the failure")
				_, err = pending.Get(context.Background(), testNamespace, obj.GetName())
				require.True(t, apierrors.IsNotFound(err))
				require.ErrorIs(t, lastGetCtx.Err(), context.Canceled, "successful reconciliation releases its budget")
				require.Equal(t, original, m.get("a"))
			})
		})
	}
}

func TestController_PendingReconcileTimeoutIncludesOptionalCapture(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.userDelete("a")
		pending := NewPendingClient(newFake(pendingObject("a", "a-uid")))
		var captureErr error
		var captureBudget time.Duration
		store := stalledPendingStore{PendingStore: pending,
			get: func(ctx context.Context, namespace, name string) (*pendingv1alpha1.PendingFolderDeletion, error) {
				time.Sleep(28 * time.Second)
				return pending.Get(ctx, namespace, name)
			},
			capture: func(ctx context.Context, _ *pendingv1alpha1.PendingFolderDeletion, _ metav1.Time) error {
				deadline, _ := ctx.Deadline()
				captureBudget = time.Until(deadline)
				<-ctx.Done()
				captureErr = ctx.Err()
				return captureErr
			},
		}
		c := NewController(m, nil, nil, WithPendingRecovery(store))
		defer c.ShutDown()
		start := time.Now()
		require.NoError(t, c.reconcilePending(context.Background(), pendingQueuePrefix+testNamespace+"/"+pendingv1alpha1.PendingDeletionName("a", "a-uid")))
		synctest.Wait()
		require.Equal(t, 30*time.Second, time.Since(start), "optional capture cannot extend the total budget")
		require.Equal(t, 2*time.Second, captureBudget)
		require.ErrorIs(t, captureErr, context.DeadlineExceeded)
		entry, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
		require.NoError(t, err)
		require.Nil(t, entry.Spec.DeletionTimestamp)
		key, shutdown := c.queue.Get()
		require.False(t, shutdown)
		require.Equal(t, testNamespace+"/a", key, "optional failure still schedules ordinary cascade work")
		c.queue.Done(key)
	})
}

func TestController_PendingReconcileTimeoutReleasesWorkers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("ordinary", "", foldersv1.CascadeDeleteFinalizer)
		m.userDelete("ordinary")
		objects := make([]runtime.Object, 0, 4)
		attempts := map[string]int{}
		for i := range 4 {
			obj := pendingObject(fmt.Sprintf("stalled-%d", i), "old-uid")
			objects = append(objects, obj)
			attempts[obj.GetName()] = 0
		}
		pending := NewPendingClient(newFake(objects...))
		var mu sync.Mutex
		getAttempts := func() map[string]int {
			mu.Lock()
			defer mu.Unlock()
			return maps.Clone(attempts)
		}
		started := make(chan struct{}, 4)
		store := stalledPendingStore{PendingStore: pending, get: func(ctx context.Context, namespace, name string) (*pendingv1alpha1.PendingFolderDeletion, error) {
			mu.Lock()
			attempt, tracked := attempts[name]
			if tracked {
				attempts[name]++
			}
			mu.Unlock()
			if tracked && attempt == 0 {
				started <- struct{}{}
				<-ctx.Done()
				return nil, ctx.Err()
			}
			return pending.Get(ctx, namespace, name)
		}}
		c := NewController(m, newTestReconciler(m, 100), nil, WithPendingRecovery(store))
		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan struct{})
		go func() { defer close(done); c.Run(ctx, 4) }()
		defer func() { cancel(); <-done }()
		for range 4 {
			<-started
		}
		c.queue.Add(testNamespace + "/ordinary")
		synctest.Wait()
		require.Zero(t, m.getCount("ordinary"), "all four workers are occupied by pending reads")
		time.Sleep(30 * time.Second)
		synctest.Wait()
		require.False(t, m.exists("ordinary"), "ordinary cascade must progress once pending reads time out")
		for name := range getAttempts() {
			require.Equal(t, 1, c.queue.NumRequeues(pendingQueuePrefix+testNamespace+"/"+name))
		}
		time.Sleep(5 * time.Millisecond)
		synctest.Wait()
		page, err := pending.List(context.Background(), "", "")
		require.NoError(t, err)
		require.Empty(t, page.Items, "all four timed-out intents retry successfully")
		for name, count := range getAttempts() {
			require.Equal(t, 2, count)
			require.Zero(t, c.queue.NumRequeues(pendingQueuePrefix+testNamespace+"/"+name))
		}
	})
}

func TestController_PendingInvalidKeyIsForgotten(t *testing.T) {
	for _, key := range []string{"pending/default/entry/extra", "pending/unknown/entry", "pending//entry", "pending/default/"} {
		t.Run(key, func(t *testing.T) {
			fake := newFake(pendingObject("a", "a-uid"))
			pending := NewPendingClient(fake)
			c := NewController(newMemStore(), nil, nil, WithPendingRecovery(pending))
			defer c.ShutDown()
			c.queue.Add(key)
			require.True(t, c.processNext(context.Background()))
			require.Zero(t, c.queue.NumRequeues(key))
			require.Empty(t, fake.Actions(), "invalid keys must not access or mutate entries")
			_, err := pending.Get(context.Background(), testNamespace, pendingv1alpha1.PendingDeletionName("a", "a-uid"))
			require.NoError(t, err)
		})
	}
}

func TestController_PendingShutdownCancelsInflightScan(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		started, exited := make(chan struct{}), make(chan struct{})
		store := pagedPendingStore{list: func(ctx context.Context, _, _ string) (*pendingv1alpha1.PendingFolderDeletionList, error) {
			close(started)
			<-ctx.Done()
			close(exited)
			return nil, ctx.Err()
		}}
		c := NewController(newMemStore(), nil, nil, WithPendingRecovery(store))
		stop := run(c)
		<-started
		stop()
		select {
		case <-exited:
		default:
			t.Fatal("scan still running after shutdown")
		}
	})
}

func TestController_LargeFolderCompletesOverSeveralPasses(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", dashNames("d", 300)...)
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.Zero(t, m.noIdentity, "every call must run as the service identity")
		require.Len(t, m.deleteCalls, 300)
		// 3 batches and the release, plus at most the trailing not-found from the release's own events.
		require.GreaterOrEqual(t, m.getCount("a"), 4)
		require.LessOrEqual(t, m.getCount("a"), 6)
	})
}

func TestController_NestedFoldersResolveBottomUpThroughWakeUps(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("c", "b", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("z", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "a1", "a2")
		m.addDashboards("b", "b1", "b2")
		m.addDashboards("c", "c1", "c2")
		m.addDashboards("z", "keep")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.False(t, m.exists("b"))
		require.False(t, m.exists("c"))
		require.True(t, m.exists("z"))
		require.Equal(t, map[string]string{"keep": "z"}, m.dashboards)
		// a deletes its batch, waits, and is woken once by b's release.
		require.LessOrEqual(t, m.getCount("a"), 5)
	})
}

func TestController_WaitingParentStaysIdle(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		// b's own cascade finishes, but another finalizer keeps it terminating.
		m.addFolder("b", "a", otherFinalizer, foldersv1.CascadeDeleteFinalizer)
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()
		require.True(t, m.exists("b"))
		passes := m.getCount("a")

		time.Sleep(time.Hour)
		synctest.Wait()
		require.Equal(t, passes, m.getCount("a"), "a waiting parent must not poll")
		require.True(t, m.exists("a"))
	})
}

func TestController_SubfolderHeldByAnotherFinalizerLeavesParentToResync(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", otherFinalizer, foldersv1.CascadeDeleteFinalizer)
		c, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		// Another controller releases b. Its delete event names only b, so nothing wakes a.
		m.mu.Lock()
		delete(m.folders, "b")
		m.notify("b", true)
		m.mu.Unlock()
		synctest.Wait()
		require.True(t, m.exists("a"))

		// The event source's resync delivers a again, and it finishes.
		c.Handler().OnUpdate(folderObj("a"), folderObj("a"))
		synctest.Wait()
		require.False(t, m.exists("a"))
	})
}

func TestController_FailureBacksOffThenRecovers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "d1")
		m.failDelete["d1"] = errors.New("boom")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()
		time.Sleep(100 * time.Millisecond)
		synctest.Wait()
		require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateFailed, m.get("a").Status.CascadeDelete.State)
		// 5ms, 10ms, 20ms, 40ms...: a handful of retries in 100ms, not a tight loop.
		require.Less(t, m.getCount("a"), 10)

		m.mu.Lock()
		delete(m.failDelete, "d1")
		m.mu.Unlock()
		time.Sleep(2 * time.Second)
		synctest.Wait()
		require.False(t, m.exists("a"))
	})
}

func TestController_StaleSearchHitsBackOff(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		lag := &lagLister{memStore: m, stale: []Child{{ChildDashboard, "d1"}}, passes: 5}
		r := newTestReconciler(m, 100)
		setLister(r, lag)
		c := NewController(m, r, nil)
		m.handler = c.Handler()
		stop := run(c)
		defer stop()

		m.userDelete("a")
		synctest.Wait()
		require.Positive(t, lag.remaining(), "stale passes must back off, not run back to back")
		time.Sleep(time.Second)
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.Zero(t, lag.remaining())
		// The first status write's event skips the backoff once, so bound rather than pin the count.
		require.Less(t, m.getCount("a"), 10)
	})
}

// lagLister lists stale children for the first passes passes, like a search index that has not
// caught up with deletes yet.
type lagLister struct {
	*memStore
	mu     sync.Mutex
	stale  []Child
	passes int
	// listing is whether the current pass still sees the stale children.
	listing bool
}

func (l *lagLister) ListChildren(ctx context.Context, ns, folderUID string, kind ChildKind, offset, limit int64) ([]Child, int64, error) {
	all, _, err := l.memStore.ListChildren(ctx, ns, folderUID, kind, 0, 1<<31)
	l.mu.Lock()
	defer l.mu.Unlock()
	// Each pass lists folders first, so count a pass on that call.
	if kind == ChildFolder && l.passes > 0 {
		l.passes--
		l.listing = true
	} else if kind == ChildFolder {
		l.listing = false
	}
	if l.listing {
		for _, c := range l.stale {
			if c.Kind == kind {
				all = append(all, c)
			}
		}
	}
	return pageOf(all, offset, limit), int64(len(all)), err
}

func (l *lagLister) remaining() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.passes
}

func TestController_MissingFolderIsDropped(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		c, stop := startController(t, m, 100)
		defer stop()

		c.Handler().OnAdd(folderObj("ghost"), false)
		synctest.Wait()
		require.Equal(t, 1, m.getCount("ghost"))

		time.Sleep(time.Hour)
		synctest.Wait()
		require.Equal(t, 1, m.getCount("ghost"))
	})
}

func TestController_TombstoneIsEnqueued(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		c, stop := startController(t, m, 100)
		defer stop()

		c.Handler().OnDelete(cache.DeletedFinalStateUnknown{Key: testNamespace + "/a", Obj: folderObj("a")})
		synctest.Wait()
		require.Equal(t, 1, m.getCount("a"))
	})
}

func TestController_WakesNonTerminatingParentHarmlessly(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("p", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "p", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("b", "b1")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("b")
		synctest.Wait()

		require.False(t, m.exists("b"))
		require.Equal(t, 1, m.getCount("p"), "b's release wakes p once")
		p := m.get("p")
		require.NotNil(t, p)
		require.Nil(t, p.Status.CascadeDelete)
	})
}

func TestController_RootFolderReleaseEnqueuesNothing(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", "d1")
		_, stop := startController(t, m, 100)
		defer stop()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		m.mu.Lock()
		defer m.mu.Unlock()
		require.Equal(t, []string{"a"}, sortedKeys(m.gets))
		require.Zero(t, m.gets[""])
	})
}

func TestController_TwoControllersShareStore(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("c", "b", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("z", "", foldersv1.CascadeDeleteFinalizer)
		m.addDashboards("a", dashNames("a", 30)...)
		m.addDashboards("b", dashNames("b", 30)...)
		m.addDashboards("c", dashNames("c", 30)...)
		m.addDashboards("z", "keep")
		c1 := NewController(m, newTestReconciler(m, 10), nil)
		c2 := NewController(m, newTestReconciler(m, 10), nil)
		m.handler = fanout{c1.Handler(), c2.Handler()}
		stop1, stop2 := run(c1), run(c2)
		defer stop1()
		defer stop2()

		m.userDelete("a")
		synctest.Wait()

		require.False(t, m.exists("a"))
		require.False(t, m.exists("b"))
		require.False(t, m.exists("c"))
		require.True(t, m.exists("z"))
		require.Equal(t, map[string]string{"keep": "z"}, m.dashboards)
	})
}

// fanout delivers every event to all handlers, as a plain watch does for every replica.
type fanout []cache.ResourceEventHandler

func (f fanout) OnAdd(obj any, initial bool) {
	for _, h := range f {
		h.OnAdd(obj, initial)
	}
}

func (f fanout) OnUpdate(oldObj, newObj any) {
	for _, h := range f {
		h.OnUpdate(oldObj, newObj)
	}
}

func (f fanout) OnDelete(obj any) {
	for _, h := range f {
		h.OnDelete(obj)
	}
}

func TestController_InvalidNamespaceIsDroppedWithoutWork(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		c, stop := startController(t, m, 100)
		defer stop()

		// A namespace that cannot be parsed has no org to run as, and retrying cannot fix it.
		c.Handler().OnAdd(&foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: "not a namespace!", Name: "x"}}, false)
		synctest.Wait()

		require.Empty(t, m.gets, "nothing is read for a key that cannot be reconciled")
	})
}

// A folder is reconciled as the service for its namespace's org, and cloud stacks map to org 1, so
// none of the namespaces Grafana generates may be mistaken for one with no org to run as.
func TestController_GeneratedNamespacesAreReconciled(t *testing.T) {
	for _, namespace := range []string{"default", "org-2", "stacks-11"} {
		t.Run(namespace, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				m := newMemStore()
				m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
				m.userDelete("a")
				// No handler on the store, so the only event is the one for this namespace.
				c := NewController(m, newTestReconciler(m, 100), nil)
				stop := run(c)
				defer stop()

				c.Handler().OnAdd(&foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: "a"}}, false)
				synctest.Wait()

				require.False(t, m.exists("a"), "the folder is released, not skipped")
				require.Zero(t, m.noIdentity)
			})
		})
	}
}

func TestController_ShutDownStopsTheQueueWithoutRun(t *testing.T) {
	m := newMemStore()
	c := NewController(m, newTestReconciler(m, 100), nil)

	c.ShutDown()
	c.ShutDown() // a failed start and a later Run may both do it

	_, shutdown := c.queue.Get()
	require.True(t, shutdown, "workers started after a ShutDown must find the queue closed")
}

func TestController_ResyncOfUnchangedFoldersIsDropped(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "", foldersv1.CascadeDeleteFinalizer)
		_, stop := startController(t, m, 100)
		defer stop()

		m.mu.Lock()
		m.rvs["a"], m.rvs["b"] = 1, 1
		m.mu.Unlock()
		m.resync()
		synctest.Wait()
		require.Equal(t, 1, m.getCount("a"))
		require.Equal(t, 1, m.getCount("b"))

		for range 3 {
			time.Sleep(ResyncPeriod)
			m.resync()
			synctest.Wait()
		}
		require.Equal(t, 1, m.getCount("a"), "a resync must not read a folder nobody changed")
		require.Equal(t, 1, m.getCount("b"))

		m.mu.Lock()
		m.notify("a", false)
		m.mu.Unlock()
		synctest.Wait()
		require.Equal(t, 2, m.getCount("a"))
		require.Equal(t, 1, m.getCount("b"))
	})
}

func TestController_ResyncRetriesATerminatingFolderUntilItIsReleased(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "a", otherFinalizer, foldersv1.CascadeDeleteFinalizer)
		m.addFolder("idle", "", foldersv1.CascadeDeleteFinalizer)
		_, stop := startController(t, m, 100)
		defer stop()

		m.resync()
		synctest.Wait()
		m.userDelete("a")
		synctest.Wait()
		require.True(t, m.exists("a"), "a waits for b, which another finalizer holds")
		passes, idlePasses := m.getCount("a"), m.getCount("idle")

		// No event names a, so only a resync can finish it.
		m.mu.Lock()
		delete(m.folders, "b")
		m.notify("b", true)
		m.mu.Unlock()
		synctest.Wait()
		require.True(t, m.exists("a"))

		time.Sleep(ResyncPeriod)
		m.resync()
		synctest.Wait()
		require.False(t, m.exists("a"))
		require.Greater(t, m.getCount("a"), passes)
		require.Equal(t, idlePasses, m.getCount("idle"), "the resync must not read a folder that is not terminating")
	})
}

func TestController_DeletedFolderIsEnqueuedAgainWhenItComesBack(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		_, stop := startController(t, m, 100)
		defer stop()

		m.mu.Lock()
		m.rvs["a"] = 1
		m.mu.Unlock()
		m.resync()
		synctest.Wait()
		require.Equal(t, 1, m.getCount("a"))

		// The delete forgets the version, so a re-created folder at an equal version is read.
		m.mu.Lock()
		delete(m.folders, "a")
		m.notify("a", true)
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.rvs["a"] = 1
		m.mu.Unlock()
		synctest.Wait()
		m.resync()
		synctest.Wait()
		require.Equal(t, 3, m.getCount("a"), "one read for the delete event, one for the re-created folder")
	})
}

func TestController_InitialListIsRecordedWithoutReads(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.addFolder("b", "", foldersv1.CascadeDeleteFinalizer)
		_, stop := startController(t, m, 100)
		defer stop()

		m.mu.Lock()
		m.rvs["a"], m.rvs["b"] = 1, 1
		m.mu.Unlock()
		m.initialList()
		time.Sleep(ResyncPeriod)
		m.resync()
		synctest.Wait()
		require.Zero(t, m.getCount("a"))
		require.Zero(t, m.getCount("b"))

		// Live changes are still reconciled, and a folder the list did not have is read.
		m.userDelete("a")
		m.mu.Lock()
		m.addFolder("c", "", foldersv1.CascadeDeleteFinalizer)
		m.notify("c", false)
		m.mu.Unlock()
		synctest.Wait()
		require.False(t, m.exists("a"))
		require.Positive(t, m.getCount("c"))
		require.Zero(t, m.getCount("b"))
	})
}

// A known, temporary limitation: the initial list is only recorded, so a folder already terminating
// at start waits for its next change.
//
// TODO(filewalkwithme): once such folders are resumed at start, this must assert the folder is
// released with no further change, and be renamed.
func TestController_FolderTerminatingAtStartWaitsForItsNextChange(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		m.folders["a"].terminating = true
		_, stop := startController(t, m, 100)
		defer stop()

		m.mu.Lock()
		m.rvs["a"] = 1
		m.mu.Unlock()
		m.initialList()
		time.Sleep(ResyncPeriod)
		m.resync()
		synctest.Wait()
		require.True(t, m.exists("a"))
		require.Zero(t, m.getCount("a"))

		m.mu.Lock()
		m.notify("a", false)
		m.mu.Unlock()
		synctest.Wait()
		require.False(t, m.exists("a"))
	})
}

func TestController_EventWithoutVersionForgetsTheRecordedOne(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		m := newMemStore()
		m.addFolder("a", "", foldersv1.CascadeDeleteFinalizer)
		c, stop := startController(t, m, 100)
		defer stop()

		withVersion := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: "a", ResourceVersion: "1"}}
		c.Handler().OnAdd(withVersion, true)
		c.Handler().OnAdd(folderObj("a"), true)
		c.Handler().OnUpdate(withVersion, withVersion)
		synctest.Wait()
		require.Equal(t, 1, m.getCount("a"), "a version recorded before a versionless list entry must not match later")
	})
}
