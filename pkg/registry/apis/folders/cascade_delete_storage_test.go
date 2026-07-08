package folders

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	apitypes "k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// newDashboardCascade wires a cascade storage to a fake dashboard apiserver client seeded with objs.
func newDashboardCascade(store grafanarest.Storage, searcher resourcepb.ResourceIndexClient, objs ...runtime.Object) (*cascadeDeleteStorage, *dynamicfake.FakeDynamicClient) {
	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: "DashboardList"}, objs...)
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		c := dyn.Resource(gvr)
		return &c, nil
	}}
	return s, dyn
}

// fakeFolderStorage records folder deletes and label stamps; only Delete/Update are exercised.
type fakeFolderStorage struct {
	grafanarest.Storage
	existing map[string]*foldersv1.Folder
	deleted  []string
	stamped  []string
}

func (f *fakeFolderStorage) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	fol, ok := f.existing[name]
	if !ok {
		return nil, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	return fol, nil
}

func (f *fakeFolderStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	fol, ok := f.existing[name]
	if !ok {
		return nil, false, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	// Mirror genericregistry: run delete admission against the fetched object before removing it.
	if deleteValidation != nil {
		if err := deleteValidation(ctx, fol); err != nil {
			return nil, false, err
		}
	}
	// Mirror generic storage enforcing preconditions against the target object.
	if pre := options.Preconditions; pre != nil {
		if (pre.UID != nil && *pre.UID != fol.UID) || (pre.ResourceVersion != nil && *pre.ResourceVersion != fol.ResourceVersion) {
			return nil, false, apierrors.NewConflict(foldersv1.FolderResourceInfo.GroupResource(), name, errors.New("precondition failed"))
		}
	}
	if isDryRun(options.DryRun) {
		return fol, false, nil
	}
	delete(f.existing, name)
	f.deleted = append(f.deleted, name)
	return fol, false, nil
}

func (f *fakeFolderStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	fol, ok := f.existing[name]
	if !ok {
		return nil, false, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	obj, err := objInfo.UpdatedObject(ctx, fol)
	if err != nil {
		return nil, false, err
	}
	updated := obj.(*foldersv1.Folder)
	if isDryRun(options.DryRun) {
		return updated, false, nil
	}
	f.existing[name] = updated
	if updated.Labels[folderTerminatingLabel] == folderTerminatingLabelValue {
		f.stamped = append(f.stamped, name)
	}
	return updated, false, nil
}

func isDryRun(dryRun []string) bool {
	return len(dryRun) > 0
}

// watchableFolderStorage adds the optional Watcher/CollectionDeleter interfaces to the fake.
type watchableFolderStorage struct {
	*fakeFolderStorage
	watched           bool
	deletedCollection bool
}

func (w *watchableFolderStorage) Watch(context.Context, *metainternalversion.ListOptions) (watch.Interface, error) {
	w.watched = true
	return watch.NewEmptyWatch(), nil
}

func (w *watchableFolderStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *metainternalversion.ListOptions) (runtime.Object, error) {
	w.deletedCollection = true
	return nil, nil
}

// fakeCascadeSearcher returns folder children and dashboards by folder UID, keyed off the request's
// resource and the folder field filter.
type fakeCascadeSearcher struct {
	resourcepb.ResourceIndexClient
	childrenByParent   map[string][]string
	dashboardsByFolder map[string][]string
	searchCtx          context.Context
}

func (s *fakeCascadeSearcher) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	s.searchCtx = ctx
	var names []string
	for _, uid := range folderFilterValues(req) {
		switch req.Options.Key.Resource {
		case foldersv1.FolderResourceInfo.GroupVersionResource().Resource:
			names = append(names, s.childrenByParent[uid]...)
		case dashv1.DashboardResourceInfo.GroupVersionResource().Resource:
			names = append(names, s.dashboardsByFolder[uid]...)
		}
	}
	rows := make([]*resourcepb.ResourceTableRow, 0, len(names))
	for _, n := range names {
		rows = append(rows, &resourcepb.ResourceTableRow{Key: &resourcepb.ResourceKey{Name: n}})
	}

	// Honor offset/limit so multi-page enumeration is exercised.
	total := int64(len(rows))
	start := min(req.Offset, total)
	end := total
	if req.Limit > 0 && start+req.Limit < end {
		end = start + req.Limit
	}
	return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{Rows: rows[start:end]}, TotalHits: total}, nil
}

func folderFilterValues(req *resourcepb.ResourceSearchRequest) []string {
	if req.Options == nil {
		return nil
	}
	for _, f := range req.Options.Fields {
		if f.Key == resource.SEARCH_FIELD_FOLDER {
			return f.Values
		}
	}
	return nil
}

func newFolder(name string) *foldersv1.Folder {
	f := &foldersv1.Folder{}
	f.Name = name
	return f
}

func unstructuredDashboard(namespace, name string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(dashv1.DashboardResourceInfo.GroupVersionKind())
	u.SetNamespace(namespace)
	u.SetName(name)
	return u
}

// nilDashboardClient stands in for deployments where no dashboard apiserver client is configured.
func nilDashboardClient(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	return nil, nil
}

func ctxWithNamespace() context.Context {
	return apirequest.WithNamespace(context.Background(), "default")
}

// forceDelete is the gracePeriodSeconds=0 opt-in required to cascade-delete a non-empty folder.
func forceDelete() *metav1.DeleteOptions {
	zero := int64(0)
	return &metav1.DeleteOptions{GracePeriodSeconds: &zero}
}

func TestCascadeDelete_DeletesSubtreeDepthFirst(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{
		"root": newFolder("root"), "child": newFolder("child"), "leaf": newFolder("leaf"),
	}}
	searcher := &fakeCascadeSearcher{
		childrenByParent:   map[string][]string{"root": {"child"}, "child": {"leaf"}},
		dashboardsByFolder: map[string][]string{"child": {"dash-1"}},
	}

	s, dyn := newDashboardCascade(store, searcher, unstructuredDashboard("default", "dash-1"))

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)

	// Leaves are deleted before their parents, and every folder in the subtree is stamped.
	require.Equal(t, []string{"leaf", "child", "root"}, store.deleted)
	require.ElementsMatch(t, []string{"root", "child", "leaf"}, store.stamped)

	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	_, err = dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), "dash-1", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "dashboard should be deleted")
}

func TestCascadeDelete_DeletesAllDashboardsInFolder(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-1", "dash-2"}}}
	s, dyn := newDashboardCascade(store, searcher,
		unstructuredDashboard("default", "dash-1"), unstructuredDashboard("default", "dash-2"))

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, []string{"root"}, store.deleted)

	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	for _, name := range []string{"dash-1", "dash-2"} {
		_, err := dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), name, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "dashboard %s should be deleted", name)
	}
}

func TestCascadeDelete_DeletesDashboardsAcrossPages(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// Force multi-page enumeration to guard against offset paging skipping items mid-delete.
	prev := childFolderPageSize
	childFolderPageSize = 2
	t.Cleanup(func() { childFolderPageSize = prev })

	names := []string{"d1", "d2", "d3", "d4", "d5"}
	objs := make([]runtime.Object, len(names))
	for i, n := range names {
		objs[i] = unstructuredDashboard("default", n)
	}
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": names}}
	s, dyn := newDashboardCascade(store, searcher, objs...)

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)

	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	for _, n := range names {
		_, err := dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), n, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "dashboard %s should be deleted", n)
	}
}

func TestCascadeDelete_PropagatesDeleteOptionsToDashboards(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-1"}}}
	s, dyn := newDashboardCascade(store, searcher, unstructuredDashboard("default", "dash-1"))

	// Capture the options the dashboard delete is called with.
	var got metav1.DeleteOptions
	dyn.PrependReactor("delete", "dashboards", func(a k8stesting.Action) (bool, runtime.Object, error) {
		got = a.(k8stesting.DeleteActionImpl).DeleteOptions
		return false, nil, nil
	})

	opts := forceDelete()
	opts.DryRun = []string{metav1.DryRunAll}
	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, opts)
	require.NoError(t, err)

	require.Equal(t, []string{metav1.DryRunAll}, got.DryRun)
	require.NotNil(t, got.GracePeriodSeconds)
	require.Equal(t, int64(0), *got.GracePeriodSeconds)
}

func TestCascadeDelete_DashboardNotFoundTolerated(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// The index returns a dashboard absent from the apiserver (stale entry / prior partial run).
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-ghost"}}}
	s, _ := newDashboardCascade(store, searcher)

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, []string{"root"}, store.deleted)
}

func TestCascadeDelete_DashboardClientNilSkips(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// No dashboard client configured: dashboards are skipped but the folder still cascades.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-1"}}}
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, []string{"root"}, store.deleted)
}

func TestCascadeDelete_DashboardClientErrorAborts(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-1"}}}
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		return nil, errors.New("boom")
	}}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.Error(t, err)
	require.Empty(t, store.deleted, "folder must not be deleted when dashboard cleanup fails")
}

func TestCascadeDelete_DashboardDeleteErrorPropagates(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-1"}}}
	s, dyn := newDashboardCascade(store, searcher, unstructuredDashboard("default", "dash-1"))

	// A non-NotFound delete failure aborts the cascade.
	dyn.PrependReactor("delete", "dashboards", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("delete failed")
	})

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.Error(t, err)
	require.Empty(t, store.deleted, "folder must not be deleted when a dashboard delete fails")
}

func TestCascadeDelete_IdempotentOnMissingChild(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// "ghost" is returned by the index but absent from storage (stale entry / prior partial run).
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"ghost"}}}

	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, []string{"root"}, store.deleted)
}

func TestCascadeDelete_NonForceDoesNotEmptyFolder(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// Without the force opt-in, the folder must not be emptied before validation runs.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{
		childrenByParent:   map[string][]string{"root": {"child"}},
		dashboardsByFolder: map[string][]string{"root": {"dash-1"}},
	}
	s, dyn := newDashboardCascade(store, searcher, unstructuredDashboard("default", "dash-1"))

	// Stand-in for validateOnDelete rejecting a non-empty folder.
	reject := func(context.Context, runtime.Object) error { return errors.New("folder is not empty") }

	_, _, err := s.Delete(ctxWithNamespace(), "root", reject, &metav1.DeleteOptions{})
	require.Error(t, err)
	require.Empty(t, store.deleted)
	require.Empty(t, store.stamped, "folder must not be stamped/cascaded without the force opt-in")

	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	_, err = dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), "dash-1", metav1.GetOptions{})
	require.NoError(t, err, "dashboard must not be deleted without the force opt-in")
}

func TestCascadeDelete_MissingRequestedFolderReturnsNotFound(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// Deleting a folder that doesn't exist must still return 404, not a fake success.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{}}
	s := &cascadeDeleteStorage{Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient}

	_, _, err := s.Delete(ctxWithNamespace(), "ghost", nil, forceDelete())
	require.True(t, apierrors.IsNotFound(err))
}

func TestCascadeDelete_DryRunDoesNotMutate(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// A dry-run force delete must not stamp or delete anything.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	s := &cascadeDeleteStorage{Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient}

	opts := forceDelete()
	opts.DryRun = []string{metav1.DryRunAll}
	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, opts)
	require.NoError(t, err)

	require.Empty(t, store.stamped, "dry-run must not stamp the terminating label")
	require.Empty(t, store.deleted, "dry-run must not delete the folder")
}

func TestCascadeDelete_RootValidationRejectsBeforeCascade(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root"), "child": newFolder("child")}}
	searcher := &fakeCascadeSearcher{
		childrenByParent:   map[string][]string{"root": {"child"}},
		dashboardsByFolder: map[string][]string{"root": {"dash-1"}},
	}
	s, dyn := newDashboardCascade(store, searcher, unstructuredDashboard("default", "dash-1"))

	// Root admission rejects: nothing in the subtree may be touched.
	reject := func(context.Context, runtime.Object) error { return errors.New("not allowed") }

	_, _, err := s.Delete(ctxWithNamespace(), "root", reject, forceDelete())
	require.Error(t, err)
	require.Empty(t, store.deleted)
	require.Empty(t, store.stamped)
	require.Contains(t, store.existing, "child", "child must survive a rejected root delete")

	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	_, getErr := dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), "dash-1", metav1.GetOptions{})
	require.NoError(t, getErr, "dashboard must survive a rejected root delete")
}

func TestCascadeDelete_StalePreconditionAbortsBeforeCascade(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	root := newFolder("root")
	root.UID = "uid-1"
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": root, "child": newFolder("child")}}
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"child"}}}
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient}

	stale := apitypes.UID("uid-stale")
	opts := forceDelete()
	opts.Preconditions = &metav1.Preconditions{UID: &stale}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, opts)
	require.True(t, apierrors.IsConflict(err))
	require.Empty(t, store.deleted)
	require.Empty(t, store.stamped)
	require.Contains(t, store.existing, "child", "child must survive a failed precondition")
}

func TestCascadeDelete_MatchingPreconditionProceeds(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// Root precondition matches; the child (different uid) must not inherit it and still be deleted.
	root := newFolder("root")
	root.UID = "uid-1"
	child := newFolder("child")
	child.UID = "uid-2"
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": root, "child": child}}
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"child"}}}
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient}

	uid := apitypes.UID("uid-1")
	opts := forceDelete()
	opts.Preconditions = &metav1.Preconditions{UID: &uid}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, opts)
	require.NoError(t, err)
	require.Equal(t, []string{"child", "root"}, store.deleted)
}

func TestCascadeDelete_ForwardsOptionalInterfaces(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, false)

	inner := &watchableFolderStorage{fakeFolderStorage: &fakeFolderStorage{existing: map[string]*foldersv1.Folder{}}}
	s := newCascadeDeleteStorage(inner, &fakeCascadeSearcher{}, nilDashboardClient)

	watcher, ok := s.(rest.Watcher)
	require.True(t, ok, "watch must be exposed when the wrapped store supports it")
	_, err := watcher.Watch(ctxWithNamespace(), nil)
	require.NoError(t, err)
	require.True(t, inner.watched)

	deleter, ok := s.(rest.CollectionDeleter)
	require.True(t, ok, "deletecollection must be exposed when the wrapped store supports it")
	_, err = deleter.DeleteCollection(ctxWithNamespace(), nil, nil, nil)
	require.NoError(t, err)
	require.True(t, inner.deletedCollection)
}

func TestCascadeDelete_RejectsForcedCollectionDelete(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// A forced collection delete can't cascade, so it's rejected rather than orphaning content.
	inner := &watchableFolderStorage{fakeFolderStorage: &fakeFolderStorage{existing: map[string]*foldersv1.Folder{}}}
	deleter := newCascadeDeleteStorage(inner, &fakeCascadeSearcher{}, nilDashboardClient).(rest.CollectionDeleter)

	_, err := deleter.DeleteCollection(ctxWithNamespace(), nil, forceDelete(), nil)
	require.True(t, apierrors.IsBadRequest(err))
	require.False(t, inner.deletedCollection, "underlying collection delete must not run")

	// A non-force collection delete still forwards (the per-folder empty check protects it).
	_, err = deleter.DeleteCollection(ctxWithNamespace(), nil, &metav1.DeleteOptions{}, nil)
	require.NoError(t, err)
	require.True(t, inner.deletedCollection)
}

func TestCascadeDelete_OptionalInterfacesNotExposedWhenUnsupported(t *testing.T) {
	// Wrapped store lacks Watcher/CollectionDeleter: the wrapper must not advertise those verbs.
	s := newCascadeDeleteStorage(&fakeFolderStorage{}, &fakeCascadeSearcher{}, nilDashboardClient)

	_, isWatcher := s.(rest.Watcher)
	require.False(t, isWatcher)

	_, isCollectionDeleter := s.(rest.CollectionDeleter)
	require.False(t, isCollectionDeleter)
}

func TestCascadeDelete_SearchesRunUnderServiceIdentity(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// The cascade search must run with an injected service identity, not the (unfiltered) request
	// context, so it enumerates resources the requester can't individually see.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{dashboardsByFolder: map[string][]string{"root": {"dash-1"}}}
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)

	require.NotNil(t, searcher.searchCtx)
	_, err = identity.GetRequester(searcher.searchCtx)
	require.NoError(t, err, "cascade search should carry the injected service identity")
}

func TestCascadeDelete_DisabledDelegates(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, false)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root"), "child": newFolder("child")}}
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"child"}}}

	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)

	// With the flag off only the requested folder is deleted; no cascade, no stamping.
	require.Equal(t, []string{"root"}, store.deleted)
	require.Empty(t, store.stamped)
}
