package cascadedelete

import (
	"context"
	"errors"
	"slices"
	"sort"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	testNamespace  = "default"
	otherFinalizer = "example.com/other"
)

type memFolder struct {
	parent      string
	finalizers  []string
	terminating bool
	status      *foldersv1.FolderCascadeDeleteStatus
}

// memStore is an in-memory folder/dashboard store with finalizer semantics: deleting an object that
// carries finalizers marks it terminating, and it only disappears once its last finalizer is removed.
// When handler is set, folder changes are delivered to it like the NATS informer would: minimal
// objects, an update when a folder changes and a delete once it is gone. Dashboards emit nothing, as
// the controller does not watch them.
type memStore struct {
	mu      sync.Mutex
	handler cache.ResourceEventHandler

	folders    map[string]*memFolder
	dashboards map[string]string // name -> parent folder
	// failDelete makes Delete of the named child return the error.
	failDelete map[string]error

	deleteCalls []string
	// noIdentity counts calls made without the service identity, which the remote storage client refuses.
	noIdentity   int
	statusWrites int
	listedRows   int
	// gets counts Get calls per folder: one per controller pass.
	gets map[string]int
}

func newMemStore() *memStore {
	return &memStore{folders: map[string]*memFolder{}, dashboards: map[string]string{}, failDelete: map[string]error{}, gets: map[string]int{}}
}

func (m *memStore) notify(name string, deleted bool) {
	if m.handler == nil {
		return
	}
	obj := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name}}
	if deleted {
		m.handler.OnDelete(obj)
		return
	}
	m.handler.OnUpdate(obj, obj)
}

func (m *memStore) getCount(name string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.gets[name]
}

func (m *memStore) exists(name string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.folders[name]
	return ok
}

func (m *memStore) addFolder(name, parent string, finalizers ...string) {
	m.folders[name] = &memFolder{parent: parent, finalizers: finalizers}
}

func (m *memStore) addDashboards(parent string, names ...string) {
	for _, n := range names {
		m.dashboards[n] = parent
	}
}

// userDelete is a DELETE on the folder, as the API would apply it.
func (m *memStore) userDelete(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	f := m.folders[name]
	if len(f.finalizers) == 0 {
		delete(m.folders, name)
		m.notify(name, true)
		return
	}
	f.terminating = true
	m.notify(name, false)
}

func (m *memStore) get(name string) *foldersv1.Folder {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.getLocked(name)
}

// track notes a call that lacks the service identity. The caller holds m.mu.
func (m *memStore) track(ctx context.Context) {
	if !identity.IsServiceIdentity(ctx) {
		m.noIdentity++
	}
}

func (m *memStore) Get(ctx context.Context, _, name string) (*foldersv1.Folder, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.track(ctx)
	m.gets[name]++
	f := m.getLocked(name)
	if f == nil {
		return nil, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	return f, nil
}

func (m *memStore) getLocked(name string) *foldersv1.Folder {
	f, ok := m.folders[name]
	if !ok {
		return nil
	}
	out := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name, Finalizers: slices.Clone(f.finalizers)}}
	if f.parent != "" {
		out.Annotations = map[string]string{utils.AnnoKeyFolder: f.parent}
	}
	if f.terminating {
		ts := metav1.Now()
		out.DeletionTimestamp = &ts
	}
	if f.status != nil {
		st := copyStatus(f.status)
		out.Status.CascadeDelete = &st
	}
	return out
}

func (m *memStore) childrenOf(folderUID string, kind ChildKind) []Child {
	var out []Child
	switch kind {
	case ChildFolder:
		for _, name := range sortedKeys(m.folders) {
			if m.folders[name].parent == folderUID {
				out = append(out, Child{Kind: ChildFolder, Name: name})
			}
		}
	case ChildDashboard:
		for _, name := range sortedKeys(m.dashboards) {
			if m.dashboards[name] == folderUID {
				out = append(out, Child{Kind: ChildDashboard, Name: name})
			}
		}
	}
	return out
}

func (m *memStore) ListChildren(ctx context.Context, _, folderUID string, kind ChildKind, offset, limit int64) ([]Child, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.track(ctx)
	all := m.childrenOf(folderUID, kind)
	page := pageOf(all, offset, limit)
	m.listedRows += len(page)
	return page, int64(len(all)), nil
}

func pageOf(all []Child, offset, limit int64) []Child {
	n := int64(len(all))
	start := min(offset, n)
	end := min(start+limit, n)
	return all[start:end]
}

func (m *memStore) Delete(ctx context.Context, _, parentUID string, c Child) (DeleteOutcome, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.track(ctx)
	if err := m.failDelete[c.Name]; err != nil {
		return 0, err
	}
	switch c.Kind {
	case ChildDashboard:
		if parent, ok := m.dashboards[c.Name]; !ok || parent != parentUID {
			return DeleteOutcomeGone, nil
		}
		m.deleteCalls = append(m.deleteCalls, c.Name)
		delete(m.dashboards, c.Name)
		return DeleteOutcomeDeleted, nil
	default:
		f, ok := m.folders[c.Name]
		if !ok || f.parent != parentUID {
			return DeleteOutcomeGone, nil
		}
		if f.terminating {
			return DeleteOutcomeTerminating, nil
		}
		if len(f.finalizers) == 0 {
			// Mirrors validateOnDelete: without the finalizer a forced delete gets no bypass.
			if len(m.childrenOf(c.Name, ChildFolder))+len(m.childrenOf(c.Name, ChildDashboard)) > 0 {
				return 0, errors.New("folder is not empty")
			}
			m.deleteCalls = append(m.deleteCalls, c.Name)
			delete(m.folders, c.Name)
			m.notify(c.Name, true)
			return DeleteOutcomeDeleted, nil
		}
		m.deleteCalls = append(m.deleteCalls, c.Name)
		f.terminating = true
		m.notify(c.Name, false)
		return DeleteOutcomePending, nil
	}
}

func (m *memStore) UpdateCascadeStatus(ctx context.Context, _ string, name string, s foldersv1.FolderCascadeDeleteStatus) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.track(ctx)
	f, ok := m.folders[name]
	if !ok {
		return apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	m.statusWrites++
	st := copyStatus(&s)
	f.status = &st
	m.notify(name, false)
	return nil
}

func (m *memStore) RemoveFinalizer(ctx context.Context, _ string, name string, _ []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.track(ctx)
	f, ok := m.folders[name]
	if !ok {
		return apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	f.finalizers = slices.DeleteFunc(f.finalizers, func(s string) bool { return s == foldersv1.CascadeDeleteFinalizer })
	if f.terminating && len(f.finalizers) == 0 {
		delete(m.folders, name)
		m.notify(name, true)
		return nil
	}
	m.notify(name, false)
	return nil
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func newTestReconciler(m *memStore, batch int) *Reconciler {
	return &Reconciler{
		Children:  m,
		Deleter:   m,
		Folders:   m,
		BatchSize: batch,
	}
}

// reconcileOnce reconciles the named folder from its current stored state.
func reconcileOnce(t *testing.T, r *Reconciler, m *memStore, name string) (Result, error) {
	t.Helper()
	f := m.get(name)
	require.NotNil(t, f, "folder %q is gone", name)
	return r.Reconcile(context.Background(), f)
}

// drain reconciles every terminating folder until a pass changes nothing, standing in for the
// workqueue that drives the reconciler in production.
func drain(t *testing.T, r *Reconciler, m *memStore) {
	t.Helper()
	snapshot := func() [4]int {
		return [4]int{len(m.folders), len(m.dashboards), len(m.deleteCalls), m.statusWrites}
	}
	for range 100 {
		before := snapshot()
		for _, name := range sortedKeys(m.folders) {
			f, ok := m.folders[name]
			if !ok || !f.terminating {
				continue
			}
			_, err := reconcileOnce(t, r, m, name)
			require.NoError(t, err)
		}
		if snapshot() == before {
			return
		}
	}
	t.Fatal("cascade did not converge")
}
