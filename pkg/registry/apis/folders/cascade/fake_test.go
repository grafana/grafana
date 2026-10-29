package cascade

import (
	"context"
	"errors"
	"slices"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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
type memStore struct {
	folders    map[string]*memFolder
	dashboards map[string]string // name -> parent folder
	// failDelete makes Delete of the named child return the error.
	failDelete map[string]error

	deleteCalls  []string
	statusWrites int
}

func newMemStore() *memStore {
	return &memStore{folders: map[string]*memFolder{}, dashboards: map[string]string{}, failDelete: map[string]error{}}
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
	f := m.folders[name]
	if len(f.finalizers) == 0 {
		delete(m.folders, name)
		return
	}
	f.terminating = true
}

func (m *memStore) get(name string) *foldersv1.Folder {
	f, ok := m.folders[name]
	if !ok {
		return nil
	}
	out := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name, Finalizers: slices.Clone(f.finalizers)}}
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

func (m *memStore) DirectChildren(_ context.Context, _ string, folderUID string) ([]Child, error) {
	var out []Child
	for _, name := range sortedKeys(m.folders) {
		if m.folders[name].parent == folderUID {
			out = append(out, Child{Kind: ChildFolder, Name: name})
		}
	}
	for _, name := range sortedKeys(m.dashboards) {
		if m.dashboards[name] == folderUID {
			out = append(out, Child{Kind: ChildDashboard, Name: name})
		}
	}
	return out, nil
}

func (m *memStore) Delete(_ context.Context, _, parentUID string, c Child) (DeleteOutcome, error) {
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
			if children, _ := m.DirectChildren(context.Background(), testNamespace, c.Name); len(children) > 0 {
				return 0, errors.New("folder is not empty")
			}
			m.deleteCalls = append(m.deleteCalls, c.Name)
			delete(m.folders, c.Name)
			return DeleteOutcomeDeleted, nil
		}
		m.deleteCalls = append(m.deleteCalls, c.Name)
		f.terminating = true
		return DeleteOutcomePending, nil
	}
}

func (m *memStore) UpdateCascadeStatus(_ context.Context, _ string, name string, s foldersv1.FolderCascadeDeleteStatus) error {
	f, ok := m.folders[name]
	if !ok {
		return apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	m.statusWrites++
	st := copyStatus(&s)
	f.status = &st
	return nil
}

func (m *memStore) RemoveFinalizer(_ context.Context, _ string, name string, _ []string) error {
	f, ok := m.folders[name]
	if !ok {
		return apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	f.finalizers = slices.DeleteFunc(f.finalizers, func(s string) bool { return s == foldersv1.CascadeDeleteFinalizer })
	if f.terminating && len(f.finalizers) == 0 {
		delete(m.folders, name)
	}
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
