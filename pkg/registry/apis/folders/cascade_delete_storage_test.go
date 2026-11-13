package folders

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
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

	authlib "github.com/grafana/authlib/types"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakePendingStorage struct {
	grafanarest.Storage
	entry *foldersv1.PendingFolderDeletion
}

func (s *fakePendingStorage) Create(ctx context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	if !identity.IsServiceIdentity(ctx) {
		return nil, errors.New("not internal")
	}
	if s.entry != nil {
		return nil, apierrors.NewAlreadyExists(foldersv1.PendingFolderDeletionResourceInfo.GroupResource(), s.entry.Name)
	}
	s.entry = obj.(*foldersv1.PendingFolderDeletion).DeepCopy()
	return s.entry, nil
}

func (s *fakePendingStorage) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	return s.entry, nil
}

type rolledBackPendingStorage struct {
	fakePendingStorage
	conflicts int
}

func (s *rolledBackPendingStorage) Create(ctx context.Context, obj runtime.Object, validation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if s.conflicts > 0 {
		s.conflicts--
		entry := obj.(*foldersv1.PendingFolderDeletion)
		entry.ResourceVersion = "rolled-back"
		return nil, apierrors.NewAlreadyExists(foldersv1.PendingFolderDeletionResourceInfo.GroupResource(), entry.Name)
	}
	return s.fakePendingStorage.Create(ctx, obj, validation, options)
}

func (s *rolledBackPendingStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if s.entry == nil {
		return nil, apierrors.NewNotFound(foldersv1.PendingFolderDeletionResourceInfo.GroupResource(), name)
	}
	return s.fakePendingStorage.Get(ctx, name, options)
}

func TestPendingDeleteRecorderRolledBackBatch(t *testing.T) {
	for _, conflicts := range []int{1, 100} {
		t.Run(fmt.Sprint(conflicts), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				store := &rolledBackPendingStorage{conflicts: conflicts}
				ctx := apirequest.WithNamespace(context.Background(), "default")
				f := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "uid-a"}}
				err := pendingRecorder(store)(ctx, f)
				if conflicts == 1 {
					require.NoError(t, err)
					require.Equal(t, "uid-a", store.entry.Spec.FolderUID)
					require.Empty(t, store.entry.ResourceVersion, "retry must use a fresh copy")
				} else {
					require.True(t, apierrors.IsServiceUnavailable(err), "unconfirmed intent must be retryable, not a folder 404: %v", err)
					require.Nil(t, store.entry)
				}
			})
		})
	}
}

func TestPendingDeleteRecorderIdempotent(t *testing.T) {
	store := &fakePendingStorage{}
	record := pendingRecorder(store)
	ctx := apirequest.WithNamespace(context.Background(), "default")
	f := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "arbitrary:UID/with separators"}}
	require.NoError(t, record(ctx, f))
	require.Equal(t, "default", store.entry.Namespace)
	require.Len(t, store.entry.Name, 64)
	require.Nil(t, store.entry.Spec.DeletionTimestamp)
	stamp := "2026-11-11T12:00:00Z"
	store.entry.Spec.DeletionTimestamp = &stamp
	require.NoError(t, record(ctx, f))
	require.Equal(t, &stamp, store.entry.Spec.DeletionTimestamp)
	store.entry.Spec.FolderName = "different"
	require.Error(t, record(ctx, f))
	store.entry.Spec.FolderName = f.Name
	store.entry.Spec.FolderUID = "different"
	require.Error(t, record(ctx, f))
}

func TestPendingDeleteRecorderCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		store := &rolledBackPendingStorage{conflicts: 100}
		ctx, cancel := context.WithCancel(apirequest.WithNamespace(context.Background(), "default"))
		result := make(chan error, 1)
		go func() {
			result <- pendingRecorder(store)(ctx, &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "uid-a"}})
		}()
		synctest.Wait()
		cancel()
		require.ErrorIs(t, <-result, context.Canceled)
		require.Nil(t, store.entry)
	})
}

func TestPendingDeleteAuthorizesOriginalCaller(t *testing.T) {
	user := &identity.StaticRequester{}
	ctx := identity.WithRequester(apirequest.WithNamespace(context.Background(), "default"), user)
	for _, allowed := range []bool{false, true} {
		t.Run(fmt.Sprint(allowed), func(t *testing.T) {
			store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"reports": {ObjectMeta: metav1.ObjectMeta{Name: "reports", Namespace: "default", UID: "uid-a", Annotations: map[string]string{utils.AnnoKeyFolder: "parent"}}}}}
			pending := &fakePendingStorage{}
			access := &recordingAccessClient{allow: func(req authlib.CheckRequest, parent string) bool {
				require.Nil(t, pending.entry)
				require.Equal(t, "parent", parent)
				require.Equal(t, authlib.CheckRequest{Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: "reports", Verb: utils.VerbDelete}, req)
				return allowed
			}}
			wrapped := newPendingDeleteStorage(store, pending, func(context.Context) bool { return true }, access)
			_, _, err := wrapped.Delete(ctx, "reports", func(ctx context.Context, _ runtime.Object) error {
				caller, err := identity.GetRequester(ctx)
				require.NoError(t, err)
				require.Same(t, user, caller)
				return nil
			}, nil)
			require.Len(t, access.checks, 1)
			require.Same(t, user, access.users[0])
			if allowed {
				require.NoError(t, err)
				require.NotNil(t, pending.entry)
			} else {
				require.True(t, apierrors.IsForbidden(err))
				require.Nil(t, pending.entry)
				require.Empty(t, store.deleted)
			}
		})
	}
}

func allowPendingDelete(context.Context, *foldersv1.Folder) error { return nil }

func TestPendingDeleteRecordsBeforeStorage(t *testing.T) {
	for _, mode := range []string{"success", "failure", "dry run", "disabled"} {
		t.Run(mode, func(t *testing.T) {
			store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"reports": {ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "uid-a"}}}}
			calls := 0
			wrapped := &pendingDeleteStorage{Storage: store, authorize: allowPendingDelete, enabled: func(context.Context) bool { return mode != "disabled" }, record: func(_ context.Context, f *foldersv1.Folder) error {
				calls++
				require.Empty(t, store.deleted)
				require.Equal(t, apitypes.UID("uid-a"), f.UID)
				if mode == "failure" {
					return errors.New("pending store unavailable")
				}
				return nil
			}}
			opts := &metav1.DeleteOptions{}
			if mode == "dry run" {
				opts.DryRun = []string{metav1.DryRunAll}
			}
			_, _, err := wrapped.Delete(context.Background(), "reports", nil, opts)
			if mode == "failure" {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			if mode == "dry run" || mode == "disabled" {
				require.Zero(t, calls)
			} else {
				require.Equal(t, 1, calls)
			}
			if mode == "failure" || mode == "dry run" {
				require.Empty(t, store.deleted)
			} else {
				require.Equal(t, []string{"reports"}, store.deleted)
			}
		})
	}
}

func TestPendingDeleteValidationAndFailure(t *testing.T) {
	for _, mode := range []string{"validation", "precondition", "delete failure"} {
		t.Run(mode, func(t *testing.T) {
			store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"reports": {ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "uid-a"}}}}
			pending := &fakePendingStorage{}
			wrapped := &pendingDeleteStorage{Storage: store, authorize: allowPendingDelete, enabled: func(context.Context) bool { return true }, record: func(ctx context.Context, f *foldersv1.Folder) error {
				err := pendingRecorder(pending)(ctx, f)
				delete(store.existing, f.Name)
				return err
			}}
			opts := &metav1.DeleteOptions{}
			if mode == "precondition" {
				uid := apitypes.UID("wrong")
				opts.Preconditions = &metav1.Preconditions{UID: &uid}
			}
			_, _, err := wrapped.Delete(apirequest.WithNamespace(context.Background(), "default"), "reports", func(context.Context, runtime.Object) error {
				if mode == "validation" {
					return errors.New("validation failed")
				}
				return nil
			}, opts)
			require.Error(t, err)
			require.Empty(t, store.deleted)
			if mode == "delete failure" {
				require.True(t, apierrors.IsNotFound(err))
				require.NotNil(t, pending.entry, "delete failure must retain durable intent")
			} else {
				require.Nil(t, pending.entry)
			}
		})
	}
}

func TestPendingDeletePinsIdentity(t *testing.T) {
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"reports": {ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "uid-a"}}}}
	wrapped := &pendingDeleteStorage{Storage: store, authorize: allowPendingDelete, enabled: func(context.Context) bool { return true }, record: func(context.Context, *foldersv1.Folder) error {
		store.existing["reports"] = &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "reports", UID: "uid-b"}}
		return nil
	}}
	opts := &metav1.DeleteOptions{}
	_, _, err := wrapped.Delete(context.Background(), "reports", nil, opts)
	require.True(t, apierrors.IsConflict(err))
	require.Empty(t, store.deleted)
	require.Nil(t, opts.Preconditions)
}

// newDashboardCascade wires a cascade storage to a fake dashboard apiserver client seeded with objs.
func newDashboardCascade(store grafanarest.Storage, searcher resourcepb.ResourceIndexClient, objs ...runtime.Object) (*cascadeDeleteStorage, *dynamicfake.FakeDynamicClient) {
	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: "DashboardList"}, objs...)
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		c := dyn.Resource(gvr)
		return &c, nil
	}, variableClient: nilVariableClient}
	return s, dyn
}

func newVariableCascade(store grafanarest.Storage, searcher resourcepb.ResourceIndexClient, objs ...runtime.Object) (*cascadeDeleteStorage, *dynamicfake.FakeDynamicClient) {
	gvr := dashv2beta1.VariableResourceInfo.GroupVersionResource()
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: "VariableList"}, objs...)
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, variableClient: func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		c := dyn.Resource(gvr)
		return &c, nil
	}, dashboardClient: nilDashboardClient}
	return s, dyn
}

// fakeFolderStorage records folder deletes and label stamps; only Delete/Update are exercised.
type fakeFolderStorage struct {
	grafanarest.Storage
	existing map[string]*foldersv1.Folder
	deleted  []string
	stamped  []string
}

func (f *fakeFolderStorage) List(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
	list := &foldersv1.FolderList{}
	for _, folder := range f.existing {
		list.Items = append(list.Items, *folder.DeepCopy())
	}
	return list, nil
}

func TestPendingDeleteCollectionRecordsEachFolder(t *testing.T) {
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{
		"a": {ObjectMeta: metav1.ObjectMeta{Name: "a", UID: "uid-a", ResourceVersion: "1"}},
		"b": {ObjectMeta: metav1.ObjectMeta{Name: "b", UID: "uid-b", ResourceVersion: "2"}},
	}}
	inner := &watchableFolderStorage{fakeFolderStorage: store}
	var recorded []string
	wrapped := &pendingDeleteStorage{Storage: inner, authorize: allowPendingDelete, enabled: func(context.Context) bool { return true }, record: func(_ context.Context, f *foldersv1.Folder) error {
		require.NotContains(t, store.deleted, f.Name)
		recorded = append(recorded, f.Name)
		return nil
	}}
	_, err := (pendingCollectionDeleter{storage: wrapped, inner: inner}).DeleteCollection(context.Background(), nil, &metav1.DeleteOptions{}, nil)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"a", "b"}, recorded)
	require.ElementsMatch(t, recorded, store.deleted)
	require.False(t, inner.deletedCollection, "must not bypass per-folder intent recording")
}

func TestPendingDeleteOptionalInterfaces(t *testing.T) {
	plain := &fakeFolderStorage{}
	optional := &watchableFolderStorage{fakeFolderStorage: plain}
	for _, tc := range []struct {
		name  string
		store grafanarest.Storage
		want  bool
	}{{"plain", plain, false}, {"optional", optional, true}} {
		t.Run(tc.name, func(t *testing.T) {
			wrapped := newPendingDeleteStorage(tc.store, nil, func(context.Context) bool { return false }, nil)
			w, watchOK := wrapped.(rest.Watcher)
			c, collectionOK := wrapped.(rest.CollectionDeleter)
			require.Equal(t, tc.want, watchOK)
			require.Equal(t, tc.want, collectionOK)
			if tc.want {
				_, err := w.Watch(context.Background(), nil)
				require.NoError(t, err)
				_, err = c.DeleteCollection(context.Background(), nil, nil, nil)
				require.NoError(t, err)
				require.True(t, optional.watched)
				require.True(t, optional.deletedCollection)
			}
		})
	}
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
	variablesByFolder  map[string][]string
	// errByResource fails searches for a resource with a nil response, as a unified storage server does.
	errByResource map[string]error
	searchCtx     context.Context
	requests      []*resourcepb.ResourceSearchRequest
}

func (s *fakeCascadeSearcher) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	s.searchCtx = ctx
	s.requests = append(s.requests, req)
	if err := s.errByResource[req.Options.Key.Resource]; err != nil {
		return nil, err
	}
	var names []string
	for _, uid := range folderFilterValues(req) {
		switch req.Options.Key.Resource {
		case foldersv1.FolderResourceInfo.GroupVersionResource().Resource:
			names = append(names, s.childrenByParent[uid]...)
		case dashv1.DashboardResourceInfo.GroupVersionResource().Resource:
			names = append(names, s.dashboardsByFolder[uid]...)
		case dashv2beta1.VariableResourceInfo.GroupVersionResource().Resource:
			names = append(names, s.variablesByFolder[uid]...)
		}
	}
	rows := make([]*resourcepb.ResourceSearchRow, 0, len(names))
	for _, n := range names {
		rows = append(rows, &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: n}})
	}

	// Honor offset/limit so multi-page enumeration is exercised.
	total := int64(len(rows))
	start := min(req.Offset, total)
	end := total
	if req.Limit > 0 && start+req.Limit < end {
		end = start + req.Limit
	}
	return &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: rows[start:end], TotalHits: total}, nil
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

func unstructuredVariable(namespace, name string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(dashv2beta1.VariableResourceInfo.GroupVersionKind())
	u.SetNamespace(namespace)
	u.SetName(name)
	return u
}

// nilDashboardClient stands in for deployments where no dashboard apiserver client is configured.
func nilDashboardClient(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	return nil, nil
}

func nilVariableClient(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	return nil, nil
}

func ctxWithNamespace() context.Context {
	ctx := apirequest.WithNamespace(context.Background(), "default")
	// A requester is required now that Delete captures it before the cascade.
	return identity.WithRequester(ctx, &identity.StaticRequester{})
}

// forceDelete is the gracePeriodSeconds=0 opt-in required to cascade-delete a non-empty folder.
func forceDelete() *metav1.DeleteOptions {
	zero := int64(0)
	return &metav1.DeleteOptions{GracePeriodSeconds: &zero}
}

func TestCascadeDelete_PendingIntentAuthorizesOriginalCaller(t *testing.T) {
	for _, denied := range []string{"root", "child"} {
		t.Run(denied, func(t *testing.T) {
			setKubernetesFolderCascadeDeleteToggle(t, true)
			ctx := ctxWithNamespace()
			user, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{
				"root": {ObjectMeta: metav1.ObjectMeta{Name: "root", Namespace: "default", UID: "uid-root", Annotations: map[string]string{utils.AnnoKeyFolder: "parent"}}},
			}}
			searcher := &fakeCascadeSearcher{}
			if denied == "child" {
				store.existing["child"] = &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "child", Namespace: "default", UID: "uid-child", Annotations: map[string]string{utils.AnnoKeyFolder: "root"}}}
				searcher.childrenByParent = map[string][]string{"root": {"child"}}
			}
			pending := &fakePendingStorage{}
			access := &recordingAccessClient{}
			access.allow = func(req authlib.CheckRequest, _ string) bool {
				caller := access.users[len(access.users)-1]
				return identity.IsServiceIdentityAuth(caller) || req.Resource != "folders" || req.Verb != utils.VerbDelete || req.Name != denied
			}
			wrapped := newPendingDeleteStorage(store, pending, func(context.Context) bool { return true }, access)
			cascade, _ := newDashboardCascade(wrapped, searcher)
			cascade.accessClient = access

			_, _, err = cascade.Delete(ctx, "root", nil, forceDelete())
			require.True(t, apierrors.IsForbidden(err), "original caller lacks folder delete permission: %v", err)
			require.Nil(t, pending.entry, "denied cascade must not create privileged intent")
			require.Empty(t, store.deleted)
			var deleteChecks int
			for i, check := range access.checks {
				require.Same(t, user, access.users[i])
				if check.req.Resource == "folders" && check.req.Verb == utils.VerbDelete {
					deleteChecks++
					require.Equal(t, denied, check.req.Name)
					parent := "parent"
					if denied == "child" {
						parent = "root"
					}
					require.Equal(t, parent, check.folder)
				}
			}
			require.Equal(t, 1, deleteChecks)
		})
	}
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

	var recorded []string
	wrapped := &pendingDeleteStorage{Storage: store, authorize: allowPendingDelete, enabled: func(context.Context) bool { return true }, record: func(_ context.Context, f *foldersv1.Folder) error {
		require.NotContains(t, store.deleted, f.Name)
		recorded = append(recorded, f.Name)
		return nil
	}}
	s, dyn := newDashboardCascade(wrapped, searcher, unstructuredDashboard("default", "dash-1"))

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	for _, request := range searcher.requests {
		require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, request.ResultFormat)
		require.Equal(t, []string{resource.SEARCH_FIELD_NAME}, request.Fields)
	}

	// Leaves are deleted before their parents, and every folder in the subtree is stamped.
	require.Equal(t, []string{"leaf", "child", "root"}, store.deleted)
	require.Equal(t, store.deleted, recorded)
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

func TestCascadeDelete_DeletesAllVariablesInFolder(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{variablesByFolder: map[string][]string{"root": {"var-1", "var-2"}}}
	s, dyn := newVariableCascade(store, searcher,
		unstructuredVariable("default", "var-1"), unstructuredVariable("default", "var-2"))

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	for _, request := range searcher.requests {
		require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, request.ResultFormat)
		require.Equal(t, []string{resource.SEARCH_FIELD_NAME}, request.Fields)
	}

	gvr := dashv2beta1.VariableResourceInfo.GroupVersionResource()
	for _, name := range []string{"var-1", "var-2"} {
		_, err := dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), name, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "variable %s should be deleted", name)
	}
}

// recordingContentsDeleter records the folders whose contents were requested for deletion, the
// requester each deletion was attributed to, and the ctx each call received.
type recordingContentsDeleter struct {
	folders   []string
	deletedBy []identity.Requester
	gotCtx    []context.Context
}

func (r *recordingContentsDeleter) DeleteInFolder(ctx context.Context, _, folderUID string, user identity.Requester) error {
	r.folders = append(r.folders, folderUID)
	r.deletedBy = append(r.deletedBy, user)
	r.gotCtx = append(r.gotCtx, ctx)
	return nil
}

func TestCascadeDelete_DeletesContentsPerFolder(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{
		"root": newFolder("root"), "child": newFolder("child"),
	}}
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"child"}}}
	deleter := &recordingContentsDeleter{}
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient, contentsDeleter: deleter}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"root", "child"}, deleter.folders)

	requester, err := identity.GetRequester(ctxWithNamespace())
	require.NoError(t, err)
	for _, got := range deleter.deletedBy {
		require.Equal(t, requester, got, "contents must be attributed to the real requester, not the service identity used to enumerate the cascade")
	}
}

func TestCascadeDelete_MarksUncheckedDeleteAuthorizedOnlyWhenAccessClientChecked(t *testing.T) {
	t.Run("accessClient wired and checks pass: ctx is marked for this folder", func(t *testing.T) {
		setKubernetesFolderCascadeDeleteToggle(t, true)
		store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
		deleter := &recordingContentsDeleter{}
		s := &cascadeDeleteStorage{
			Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient,
			variableClient: nilVariableClient, contentsDeleter: deleter, accessClient: &recordingAccessClient{},
		}

		_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
		require.NoError(t, err)
		require.Len(t, deleter.gotCtx, 1)

		requester, err := identity.GetRequester(ctxWithNamespace())
		require.NoError(t, err)
		require.True(t, folder.IsUncheckedDeleteAuthorized(deleter.gotCtx[0], 1, requester, []string{"root"}),
			"an Unchecked contentsDeleter must be able to trust ctx once checkFolderContentsAccess has passed")
	})

	t.Run("no accessClient wired: ctx is not marked, since nothing was actually checked", func(t *testing.T) {
		setKubernetesFolderCascadeDeleteToggle(t, true)
		store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
		deleter := &recordingContentsDeleter{}
		s := &cascadeDeleteStorage{
			Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient,
			variableClient: nilVariableClient, contentsDeleter: deleter,
		}

		_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
		require.NoError(t, err)
		require.Len(t, deleter.gotCtx, 1)

		requester, err := identity.GetRequester(ctxWithNamespace())
		require.NoError(t, err)
		require.False(t, folder.IsUncheckedDeleteAuthorized(deleter.gotCtx[0], 1, requester, []string{"root"}),
			"checkFolderContentsAccess is a no-op without an accessClient, so ctx must not claim authorization")
	})
}

func TestCascadeDelete_RejectsEnumerationIdentityAsRequester(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	deleter := &recordingContentsDeleter{}
	s := &cascadeDeleteStorage{Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient, variableClient: nilVariableClient, contentsDeleter: deleter}

	// Simulates the original bug: the real requester was lost somewhere upstream and Delete
	// captured the enumeration identity (the one WithServiceIdentityContext mints) in its place.
	ctx, _ := identity.WithServiceIdentity(apirequest.WithNamespace(context.Background(), "default"), 1)

	_, _, err := s.Delete(ctx, "root", nil, forceDelete())
	require.True(t, apierrors.IsForbidden(err), "must be a 403, not a generic error: %v", err)
	require.Empty(t, store.deleted, "folder must not be deleted when the requester is the enumeration identity")
	require.Empty(t, store.stamped, "folder must not be left stamped terminating when this guard rejects the request")
	require.Empty(t, deleter.folders)
}

func TestCascadeDelete_SkipsContentsOnDryRun(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// A server-side dry-run must not mutate contents: DeleteInFolders has no dry-run mode.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	deleter := &recordingContentsDeleter{}
	s := &cascadeDeleteStorage{Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient, variableClient: nilVariableClient, contentsDeleter: deleter}

	opts := forceDelete()
	opts.DryRun = []string{metav1.DryRunAll}
	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, opts)
	require.NoError(t, err)
	require.Empty(t, deleter.folders, "contents must not be deleted on dry-run")
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
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

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
	}, variableClient: nilVariableClient}

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

func TestCascadeDelete_ContentSearchErrorAborts(t *testing.T) {
	unavailable := &resourcepb.ErrorResult{
		Code:    http.StatusServiceUnavailable,
		Reason:  string(metav1.StatusReasonServiceUnavailable),
		Message: "index unavailable",
		Details: &resourcepb.ErrorDetails{RetryAfterSeconds: 5},
	}
	st, err := grpcstatus.New(grpccodes.Unavailable, unavailable.Message).WithDetails(unavailable)
	require.NoError(t, err)

	for name, newCascade := range map[string]func(grafanarest.Storage, resourcepb.ResourceIndexClient, ...runtime.Object) (*cascadeDeleteStorage, *dynamicfake.FakeDynamicClient){
		dashv1.DashboardResourceInfo.GroupVersionResource().Resource:     newDashboardCascade,
		dashv2beta1.VariableResourceInfo.GroupVersionResource().Resource: newVariableCascade,
	} {
		t.Run(name, func(t *testing.T) {
			setKubernetesFolderCascadeDeleteToggle(t, true)
			store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
			searcher := &fakeCascadeSearcher{errByResource: map[string]error{name: fmt.Errorf("search: %w", st.Err())}}
			s, _ := newCascade(store, searcher)

			_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())

			require.Empty(t, store.deleted, "folder must not be deleted when its contents cannot be listed")
			var apiStatus apierrors.APIStatus
			require.ErrorAs(t, err, &apiStatus)
			require.Equal(t, metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusServiceUnavailable,
				Reason:  metav1.StatusReasonServiceUnavailable,
				Message: "index unavailable",
				Details: &metav1.StatusDetails{RetryAfterSeconds: 5},
			}, apiStatus.Status())
		})
	}
}

func TestCascadeDelete_IdempotentOnMissingChild(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// "ghost" is returned by the index but absent from storage (stale entry / prior partial run).
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	searcher := &fakeCascadeSearcher{childrenByParent: map[string][]string{"root": {"ghost"}}}

	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

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
	s := &cascadeDeleteStorage{Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

	_, _, err := s.Delete(ctxWithNamespace(), "ghost", nil, forceDelete())
	require.True(t, apierrors.IsNotFound(err))
}

func TestCascadeDelete_DryRunDoesNotMutate(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// A dry-run force delete must not stamp or delete anything.
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	s := &cascadeDeleteStorage{Storage: store, searcher: &fakeCascadeSearcher{}, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

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
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

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
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

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
	s := newCascadeDeleteStorage(inner, &fakeCascadeSearcher{}, nilDashboardClient, nilVariableClient, nil, nil)

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
	deleter := newCascadeDeleteStorage(inner, &fakeCascadeSearcher{}, nilDashboardClient, nilVariableClient, nil, nil).(rest.CollectionDeleter)

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
	s := newCascadeDeleteStorage(&fakeFolderStorage{}, &fakeCascadeSearcher{}, nilDashboardClient, nilVariableClient, nil, nil)

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
	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

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

	s := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: nilDashboardClient, variableClient: nilVariableClient}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.NoError(t, err)

	// With the flag off only the requested folder is deleted; no cascade, no stamping.
	require.Equal(t, []string{"root"}, store.deleted)
	require.Empty(t, store.stamped)
}

func TestCascadeDelete_FinalizerFolderDelegates(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, true)

	// A folder carrying the cascade finalizer is left to the cascade controller: the forced delete
	// only marks it terminating, with no synchronous walk of its subtree.
	root := newFolder("root")
	root.Finalizers = []string{foldersv1.CascadeDeleteFinalizer}
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": root, "child": newFolder("child")}}
	searcher := &fakeCascadeSearcher{
		childrenByParent:   map[string][]string{"root": {"child"}},
		dashboardsByFolder: map[string][]string{"root": {"dash-1"}},
	}
	s, dyn := newDashboardCascade(store, searcher, unstructuredDashboard("default", "dash-1"))

	validated := false
	validate := func(context.Context, runtime.Object) error { validated = true; return nil }

	_, _, err := s.Delete(ctxWithNamespace(), "root", validate, forceDelete())
	require.NoError(t, err)
	require.True(t, validated, "delete validation must still run")
	require.Equal(t, []string{"root"}, store.deleted)
	require.Empty(t, store.stamped)
	require.Contains(t, store.existing, "child")

	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
	_, err = dyn.Resource(gvr).Namespace("default").Get(ctxWithNamespace(), "dash-1", metav1.GetOptions{})
	require.NoError(t, err, "dashboard must be left for the cascade controller")
}

// recordingAccessClient records Check calls and optionally filters by allow.
type recordingAccessClient struct {
	users  []authlib.AuthInfo
	checks []contentsAccessCheck
	allow  func(req authlib.CheckRequest, folder string) bool
	err    error
}

func (c *recordingAccessClient) Check(_ context.Context, user authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	c.users = append(c.users, user)
	c.checks = append(c.checks, contentsAccessCheck{req: req, folder: folder})
	if c.err != nil {
		return authlib.CheckResponse{}, c.err
	}
	allowed := true
	if c.allow != nil {
		allowed = c.allow(req, folder)
	}
	return authlib.CheckResponse{Allowed: allowed}, nil
}

func (c *recordingAccessClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func (c *recordingAccessClient) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(string, string) bool { return false }, authlib.NoopZookie{}, nil
}

func TestCheckFolderContentsAccess(t *testing.T) {
	user := &identity.StaticRequester{}
	folderGVR := foldersv1.FolderResourceInfo.GroupVersionResource()
	varGVR := dashv2beta1.VariableResourceInfo.GroupVersionResource()

	t.Run("nil accessClient is a no-op", func(t *testing.T) {
		s := &cascadeDeleteStorage{}
		require.NoError(t, s.checkFolderContentsAccess(context.Background(), user, "default", "folder", "parent"))
	})

	t.Run("without global variables, checks alert.rules:delete and folders:write only", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: false})
		ac := &recordingAccessClient{}
		s := &cascadeDeleteStorage{accessClient: ac}
		require.NoError(t, s.checkFolderContentsAccess(context.Background(), user, "default", "folder", "parent"))
		require.Equal(t, []contentsAccessCheck{
			{authlib.CheckRequest{Namespace: "default", Verb: utils.VerbDelete, Group: cascadeAlertRuleGroup, Resource: cascadeAlertRuleResource}, "folder"},
			{authlib.CheckRequest{Namespace: "default", Verb: utils.VerbUpdate, Group: folderGVR.Group, Resource: folderGVR.Resource, Name: "folder"}, "parent"},
		}, ac.checks)
	})

	t.Run("with global variables, also checks variables:delete on the folder", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: true})
		ac := &recordingAccessClient{}
		s := &cascadeDeleteStorage{accessClient: ac}
		require.NoError(t, s.checkFolderContentsAccess(context.Background(), user, "default", "folder", "parent"))
		require.Equal(t, []contentsAccessCheck{
			{authlib.CheckRequest{Namespace: "default", Verb: utils.VerbDelete, Group: cascadeAlertRuleGroup, Resource: cascadeAlertRuleResource}, "folder"},
			{authlib.CheckRequest{Namespace: "default", Verb: utils.VerbUpdate, Group: folderGVR.Group, Resource: folderGVR.Resource, Name: "folder"}, "parent"},
			{authlib.CheckRequest{Namespace: "default", Verb: utils.VerbDelete, Group: varGVR.Group, Resource: varGVR.Resource}, "folder"},
		}, ac.checks)
	})

	t.Run("root folder uses General as the folders:write parent, folder UID for variables", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: true})
		ac := &recordingAccessClient{}
		s := &cascadeDeleteStorage{accessClient: ac}
		require.NoError(t, s.checkFolderContentsAccess(context.Background(), user, "default", "root", ""))
		require.Equal(t, folder.GeneralFolderUID, ac.checks[1].folder)
		require.Equal(t, "root", ac.checks[2].folder)
	})

	t.Run("denies when variables:delete is not allowed", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: true})
		ac := &recordingAccessClient{allow: func(req authlib.CheckRequest, _ string) bool {
			return req.Resource != varGVR.Resource
		}}
		s := &cascadeDeleteStorage{accessClient: ac}
		err := s.checkFolderContentsAccess(context.Background(), user, "default", "folder", "parent")
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("surfaces Check transport error", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: false})
		ac := &recordingAccessClient{err: errors.New("boom")}
		s := &cascadeDeleteStorage{accessClient: ac}
		err := s.checkFolderContentsAccess(context.Background(), user, "default", "folder", "parent")
		require.ErrorContains(t, err, "boom")
	})
}

func TestCascadeDelete_ForbiddenWithoutVariablesDelete(t *testing.T) {
	setOpenFeatureToggles(t, map[string]bool{
		featuremgmt.FlagKubernetesFolderCascadeDelete:   true,
		featuremgmt.FlagGrafanaDashboardGlobalVariables: true,
	})

	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": newFolder("root")}}
	varGVR := dashv2beta1.VariableResourceInfo.GroupVersionResource()
	ac := &recordingAccessClient{allow: func(req authlib.CheckRequest, _ string) bool {
		return req.Resource != varGVR.Resource
	}}
	s := &cascadeDeleteStorage{
		Storage:         store,
		searcher:        &fakeCascadeSearcher{},
		dashboardClient: nilDashboardClient,
		variableClient:  nilVariableClient,
		accessClient:    ac,
	}

	_, _, err := s.Delete(ctxWithNamespace(), "root", nil, forceDelete())
	require.True(t, apierrors.IsForbidden(err))
	require.Empty(t, store.deleted, "folder must not be deleted when variables:delete is denied")
}
