package folderimpl

import (
	"context"
	"log/slog"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type mockFolderSearcher struct {
	search func(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

func (m *mockFolderSearcher) Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return m.search(ctx, orgID, in)
}

func TestListDirectChildFolders_search(t *testing.T) {
	var gotOrgID int64
	var gotParent string
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			gotOrgID = orgID
			require.Len(t, in.Options.Fields, 1)
			gotParent = in.Options.Fields[0].Values[0]
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"}, Cells: [][]byte{[]byte("folder1")}},
						{Key: &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"}, Cells: [][]byte{[]byte("folder1")}},
					},
				},
			}, nil
		},
	}

	children, err := listDirectChildFolders(context.Background(), searcher, 12, "folder1")
	require.NoError(t, err)
	require.Equal(t, []childFolder{{name: "folder2"}, {name: "folder3"}}, children)
	require.Equal(t, int64(12), gotOrgID)
	require.Equal(t, "folder1", gotParent)
}

func TestListDirectChildFolders_marksTerminatingFromLabel(t *testing.T) {
	var gotReturnFields []string
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			gotReturnFields = in.Fields
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "live", Resource: "folder"}, Cells: [][]byte{nil}},
						{Key: &resourcepb.ResourceKey{Name: "terminating", Resource: "folder"}, Cells: [][]byte{[]byte(folders.TerminatingLabelValue)}},
					},
				},
			}, nil
		},
	}

	children, err := listDirectChildFolders(context.Background(), searcher, 12, "parent")
	require.NoError(t, err)

	// The terminating label must be requested as a return field; the dedup depends on the search
	// backend echoing it back per hit.
	require.Contains(t, gotReturnFields, terminatingLabelField)
	require.Equal(t, []childFolder{
		{name: "live", terminating: false},
		{name: "terminating", terminating: true},
	}, children)
}

func TestCascadePoller_Run_disabledByFeatureFlag(t *testing.T) {
	w := ProvideCascadePoller(setting.NewCfg(), apiserver.WithoutRestConfig, nil, nil, nil, nil)
	w.flagEnabled = func(context.Context) bool { return false }
	err := w.Run(context.Background())
	require.NoError(t, err)
}

func TestCascadePoller_Run_enabledFlagWithoutRestConfig(t *testing.T) {
	w := ProvideCascadePoller(setting.NewCfg(), apiserver.WithoutRestConfig, nil, nil, nil, nil)
	w.flagEnabled = func(context.Context) bool { return true }
	err := w.Run(context.Background())
	require.NoError(t, err)
}

type deletedFolder struct {
	name        string
	gracePeriod *int64
}

type recordingFolderMutator struct {
	mu              sync.Mutex
	deleted         []deletedFolder
	finalizerRemove []string
	deleteErr       error
	removeErr       error
}

func (m *recordingFolderMutator) Delete(_ context.Context, _ string, name string, gracePeriodSeconds *int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, deletedFolder{name: name, gracePeriod: gracePeriodSeconds})
	return m.deleteErr
}

func (m *recordingFolderMutator) RemoveCascadeFinalizer(_ context.Context, _ string, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.finalizerRemove = append(m.finalizerRemove, name)
	return m.removeErr
}

func (m *recordingFolderMutator) deletedNames() []string {
	out := make([]string, 0, len(m.deleted))
	for _, d := range m.deleted {
		out = append(out, d.name)
	}
	return out
}

// childSearch returns a mock searcher whose child search (listDirectChildFolders) reports the
// given children with their terminating state.
func childSearch(children map[string]bool) *mockFolderSearcher {
	return &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			rows := make([]*resourcepb.ResourceTableRow, 0, len(children))
			for name, terminating := range children {
				var cell []byte
				if terminating {
					cell = []byte(folders.TerminatingLabelValue)
				}
				rows = append(rows, &resourcepb.ResourceTableRow{
					Key:   &resourcepb.ResourceKey{Name: name, Resource: "folder"},
					Cells: [][]byte{cell},
				})
			}
			return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: rows,
			}}, nil
		},
	}
}

func TestCascadePoller_finalizeTerminatingFolder_removesFinalizerWhenNoChildren(t *testing.T) {
	// A leaf (no children) gets its finalizer removed so it can be garbage-collected.
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "leaf")

	require.Empty(t, mut.deletedNames())
	require.Equal(t, []string{"leaf"}, mut.finalizerRemove)
}

func TestCascadePoller_finalizeTerminatingFolder_marksChildrenAndKeepsFinalizer(t *testing.T) {
	// With children present, mark the not-yet-terminating ones (skip already-terminating) and keep
	// this folder's finalizer until its subtree is gone.
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{"unmarked": false, "marked": true}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "parent")

	// Only the not-yet-terminating child is marked; the already-terminating one is skipped.
	require.Equal(t, []string{"unmarked"}, mut.deletedNames())
	require.NotNil(t, mut.deleted[0].gracePeriod)
	require.Equal(t, int64(0), *mut.deleted[0].gracePeriod)
	// Folder still has children, so its finalizer is NOT removed yet.
	require.Empty(t, mut.finalizerRemove)
}

func TestSearchTerminatingFolders(t *testing.T) {
	var gotLabels []*resourcepb.Requirement
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			gotLabels = in.Options.Labels
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "term-a", Resource: "folder"}, Cells: [][]byte{nil}},
						{Key: &resourcepb.ResourceKey{Name: "term-b", Resource: "folder"}, Cells: [][]byte{nil}},
					},
				},
			}, nil
		},
	}

	names, err := searchTerminatingFolders(context.Background(), searcher, 12)
	require.NoError(t, err)
	require.Equal(t, []string{"term-a", "term-b"}, names)

	// Discovery must filter server-side on the terminating label.
	require.Len(t, gotLabels, 1)
	require.Equal(t, folders.TerminatingLabel, gotLabels[0].Key)
	require.Equal(t, []string{folders.TerminatingLabelValue}, gotLabels[0].Values)
}

type fakeOrgLister struct {
	orgs []*org.OrgDTO
	err  error
}

func (f *fakeOrgLister) Search(context.Context, *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return f.orgs, f.err
}

func TestCascadePoller_pollOnce(t *testing.T) {
	// Discovery returns two terminating folders: "parent" (still has a terminating child) and
	// "child" (a leaf). Bottom-up: only the leaf's finalizer is removed this tick; the parent keeps
	// its finalizer until the child is gone.
	term := []byte(folders.TerminatingLabelValue)
	cols := []*resourcepb.ResourceTableColumnDefinition{
		{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
	}
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			if len(in.Options.Labels) > 0 {
				return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
					Columns: cols,
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "parent", Resource: "folder"}, Cells: [][]byte{term}},
						{Key: &resourcepb.ResourceKey{Name: "child", Resource: "folder"}, Cells: [][]byte{term}},
					},
				}}, nil
			}
			// Child search: "parent" still has the (terminating) child; "child" is a leaf.
			if in.Options.Fields[0].Values[0] == "parent" {
				return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
					Columns: cols,
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "child", Resource: "folder"}, Cells: [][]byte{term}},
					},
				}}, nil
			}
			return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{Columns: cols}}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		orgs:            &fakeOrgLister{orgs: []*org.OrgDTO{{ID: 12}}},
		namespaceMapper: func(int64) string { return "org-12" },
		folderSearch:    searcher,
		folderMutator:   mut,
		log:             slog.Default(),
	}

	w.pollOnce(context.Background())

	require.Equal(t, []string{"child"}, mut.finalizerRemove)
	require.Empty(t, mut.deletedNames())
}

func newFakeFolderClient(t *testing.T, obj *unstructured.Unstructured) dynamic.NamespaceableResourceInterface {
	t.Helper()
	gvr := foldersv1.FolderResourceInfo.GroupVersionResource()
	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: "FolderList"})
	_, err := client.Resource(gvr).Namespace(obj.GetNamespace()).Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return client.Resource(gvr)
}

func folderUnstructured(name string, finalizers ...string) *unstructured.Unstructured {
	o := &unstructured.Unstructured{}
	o.SetGroupVersionKind(foldersv1.FolderResourceInfo.GroupVersionKind())
	o.SetNamespace("org-12")
	o.SetName(name)
	if len(finalizers) > 0 {
		o.SetFinalizers(finalizers)
	}
	return o
}

func TestDynamicFolderMutator_RemoveCascadeFinalizer(t *testing.T) {
	t.Run("removes only the cascade finalizer", func(t *testing.T) {
		client := newFakeFolderClient(t, folderUnstructured("f", folders.CascadeDeleteFinalizer, "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		require.NoError(t, mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f"))

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
	})

	t.Run("leaves other finalizers untouched when the cascade finalizer is absent", func(t *testing.T) {
		client := newFakeFolderClient(t, folderUnstructured("f", "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		require.NoError(t, mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f"))

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
	})
}

func TestDynamicFolderMutator_Delete(t *testing.T) {
	client := newFakeFolderClient(t, folderUnstructured("f", folders.CascadeDeleteFinalizer))
	mut := &dynamicFolderMutator{client: client}

	grace := int64(0)
	require.NoError(t, mut.Delete(context.Background(), "org-12", "f", &grace))

	_, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err))
}
