package cascadedelete

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func newFake(objs ...runtime.Object) *dynamicfake.FakeDynamicClient {
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		folderGVR:    "FolderList",
		dashboardGVR: "DashboardList",
	}, objs...)
}

// testParent is the folder the child objects below live in.
const testParent = "a"

func childObject(gvk schema.GroupVersionKind, name string, terminating bool, finalizers ...string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(gvk)
	u.SetNamespace(testNamespace)
	u.SetName(name)
	u.SetUID(types.UID(name + "-uid"))
	u.SetResourceVersion("7")
	u.SetAnnotations(map[string]string{utils.AnnoKeyFolder: testParent})
	u.SetFinalizers(finalizers)
	if terminating {
		ts := metav1.Now()
		u.SetDeletionTimestamp(&ts)
	}
	return u
}

func unstructuredFolder(name string, terminating bool, finalizers ...string) *unstructured.Unstructured {
	return childObject(foldersv1.FolderResourceInfo.GroupVersionKind(), name, terminating, finalizers...)
}

func unstructuredDashboard(name string, terminating bool, finalizers ...string) *unstructured.Unstructured {
	return childObject(dashv1.DashboardResourceInfo.GroupVersionKind(), name, terminating, finalizers...)
}

func moved(u *unstructured.Unstructured) *unstructured.Unstructured {
	u.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "elsewhere"})
	return u
}

func deleteActions(dyn *dynamicfake.FakeDynamicClient) []k8stesting.DeleteActionImpl {
	var out []k8stesting.DeleteActionImpl
	for _, a := range dyn.Actions() {
		if d, ok := a.(k8stesting.DeleteActionImpl); ok {
			out = append(out, d)
		}
	}
	return out
}

func deleteChild(t *testing.T, dyn *dynamicfake.FakeDynamicClient, kind ChildKind, name string) (DeleteOutcome, error) {
	t.Helper()
	return NewDynamicClients(dyn).Delete(context.Background(), testNamespace, testParent, Child{Kind: kind, Name: name})
}

func TestDynamicClients_Delete(t *testing.T) {
	for _, tc := range []struct {
		kind ChildKind
		gvr  schema.GroupVersionResource
		obj  func(name string, terminating bool, finalizers ...string) *unstructured.Unstructured
	}{
		{kind: ChildDashboard, gvr: dashboardGVR, obj: unstructuredDashboard},
		{kind: ChildFolder, gvr: folderGVR, obj: unstructuredFolder},
	} {
		t.Run(string(tc.kind), func(t *testing.T) {
			t.Run("force-deletes with uid and resourceVersion preconditions", func(t *testing.T) {
				dyn := newFake(tc.obj("c", false))
				outcome, err := deleteChild(t, dyn, tc.kind, "c")
				require.NoError(t, err)
				require.Equal(t, DeleteOutcomeDeleted, outcome)

				dels := deleteActions(dyn)
				require.Len(t, dels, 1)
				require.Equal(t, tc.gvr, dels[0].GetResource())
				pre := dels[0].DeleteOptions.Preconditions
				require.Equal(t, types.UID("c-uid"), *pre.UID)
				require.Equal(t, "7", *pre.ResourceVersion)
				require.NotNil(t, dels[0].DeleteOptions.GracePeriodSeconds)
				require.Equal(t, int64(0), *dels[0].DeleteOptions.GracePeriodSeconds)
			})
			t.Run("held by finalizers is pending", func(t *testing.T) {
				dyn := newFake(tc.obj("c", false, otherFinalizer))
				outcome, err := deleteChild(t, dyn, tc.kind, "c")
				require.NoError(t, err)
				require.Equal(t, DeleteOutcomePending, outcome)
				require.Len(t, deleteActions(dyn), 1)
			})
			t.Run("terminating is skipped", func(t *testing.T) {
				dyn := newFake(tc.obj("c", true, otherFinalizer))
				outcome, err := deleteChild(t, dyn, tc.kind, "c")
				require.NoError(t, err)
				require.Equal(t, DeleteOutcomeTerminating, outcome)
				require.Empty(t, deleteActions(dyn))
			})
			t.Run("moved to another folder is not deleted", func(t *testing.T) {
				// A stale search hit must not delete the child from the folder it moved to.
				dyn := newFake(moved(tc.obj("c", false)))
				outcome, err := deleteChild(t, dyn, tc.kind, "c")
				require.NoError(t, err)
				require.Equal(t, DeleteOutcomeGone, outcome)
				require.Empty(t, deleteActions(dyn))
			})
			t.Run("missing is gone", func(t *testing.T) {
				outcome, err := deleteChild(t, newFake(), tc.kind, "c")
				require.NoError(t, err)
				require.Equal(t, DeleteOutcomeGone, outcome)
			})
			t.Run("delete error is returned", func(t *testing.T) {
				dyn := newFake(tc.obj("c", false))
				dyn.PrependReactor("delete", tc.gvr.Resource, func(k8stesting.Action) (bool, runtime.Object, error) {
					return true, nil, apierrors.NewConflict(tc.gvr.GroupResource(), "c", errors.New("changed"))
				})
				_, err := deleteChild(t, dyn, tc.kind, "c")
				require.True(t, apierrors.IsConflict(err))
			})
		})
	}
}

func patchActions(dyn *dynamicfake.FakeDynamicClient) []k8stesting.PatchActionImpl {
	var out []k8stesting.PatchActionImpl
	for _, a := range dyn.Actions() {
		if p, ok := a.(k8stesting.PatchActionImpl); ok {
			out = append(out, p)
		}
	}
	return out
}

func TestDynamicClients_UpdateCascadeStatus(t *testing.T) {
	dyn := newFake(unstructuredFolder("a", true, foldersv1.CascadeDeleteFinalizer))
	dyn.PrependReactor("patch", "folders", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, unstructuredFolder("a", true), nil
	})
	c := NewDynamicClients(dyn)
	two, started := int64(2), int64(1000)

	require.NoError(t, c.UpdateCascadeStatus(context.Background(), testNamespace, "a", foldersv1.FolderCascadeDeleteStatus{
		State:     foldersv1.FolderCascadeDeleteStatusStateInProgress,
		Total:     &two,
		Remaining: &two,
		Started:   &started,
	}))

	patches := patchActions(dyn)
	require.Len(t, patches, 1)
	require.Equal(t, "status", patches[0].GetSubresource())
	require.Equal(t, types.MergePatchType, patches[0].GetPatchType())
	require.JSONEq(t, `{"status":{"cascadeDelete":{
		"state":"InProgress","total":2,"remaining":2,"started":1000,"errors":null,"finished":null
	}}}`, string(patches[0].GetPatch()))
}

func TestDynamicClients_RemoveFinalizer(t *testing.T) {
	t.Run("removes only ours", func(t *testing.T) {
		dyn := newFake(unstructuredFolder("a", true, otherFinalizer, foldersv1.CascadeDeleteFinalizer))
		c := NewDynamicClients(dyn)

		require.NoError(t, c.RemoveFinalizer(context.Background(), testNamespace, "a", []string{otherFinalizer, foldersv1.CascadeDeleteFinalizer}))

		patches := patchActions(dyn)
		require.Len(t, patches, 1)
		require.Equal(t, types.JSONPatchType, patches[0].GetPatchType())
		require.Empty(t, patches[0].GetSubresource())
		var ops []map[string]any
		require.NoError(t, json.Unmarshal(patches[0].GetPatch(), &ops))
		require.Equal(t, []map[string]any{
			{"op": "test", "path": "/metadata/finalizers/1", "value": foldersv1.CascadeDeleteFinalizer},
			{"op": "remove", "path": "/metadata/finalizers/1"},
		}, ops)

		got, err := dyn.Resource(folderGVR).Namespace(testNamespace).Get(context.Background(), "a", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{otherFinalizer}, got.GetFinalizers())
	})
	t.Run("stale finalizer list fails instead of removing another entry", func(t *testing.T) {
		dyn := newFake(unstructuredFolder("a", true, otherFinalizer))
		err := NewDynamicClients(dyn).RemoveFinalizer(context.Background(), testNamespace, "a", []string{foldersv1.CascadeDeleteFinalizer})
		require.Error(t, err)
		got, getErr := dyn.Resource(folderGVR).Namespace(testNamespace).Get(context.Background(), "a", metav1.GetOptions{})
		require.NoError(t, getErr)
		require.Equal(t, []string{otherFinalizer}, got.GetFinalizers())
	})
	t.Run("no-op without our finalizer", func(t *testing.T) {
		dyn := newFake(unstructuredFolder("a", true, otherFinalizer))
		require.NoError(t, NewDynamicClients(dyn).RemoveFinalizer(context.Background(), testNamespace, "a", []string{otherFinalizer}))
		require.Empty(t, patchActions(dyn))
	})
	t.Run("already gone", func(t *testing.T) {
		dyn := newFake()
		require.NoError(t, NewDynamicClients(dyn).RemoveFinalizer(context.Background(), testNamespace, "a", []string{foldersv1.CascadeDeleteFinalizer}))
	})
}

// pagedSearcher serves names per resource in pages, honoring offset/limit.
type pagedSearcher struct {
	resourcepb.ResourceIndexClient
	byResource map[string][]string
	err        error
	// format overrides the result format the server reports; FIELD_VALUES when unset.
	format   resourcepb.ResourceSearchRequest_ResultFormat
	requests []*resourcepb.ResourceSearchRequest
}

func (s *pagedSearcher) Search(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	s.requests = append(s.requests, req)
	if s.err != nil {
		return nil, s.err
	}
	names := s.byResource[req.Options.Key.Resource]
	total := int64(len(names))
	start := min(req.Offset, total)
	end := min(start+req.Limit, total)
	rows := make([]*resourcepb.ResourceSearchRow, 0, end-start)
	for _, n := range names[start:end] {
		rows = append(rows, &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: n}})
	}
	format := s.format
	if format == resourcepb.ResourceSearchRequest_UNSPECIFIED {
		format = resourcepb.ResourceSearchRequest_FIELD_VALUES
	}
	return &resourcepb.ResourceSearchResponse{ResultFormat: format, Rows: rows, TotalHits: total}, nil
}

func TestSearchChildLister(t *testing.T) {
	s := &pagedSearcher{byResource: map[string][]string{
		folderGVR.Resource:    {"f1", "f2", "f3"},
		dashboardGVR.Resource: {"d1", "d2"},
	}}
	l := NewSearchChildLister(s)
	ctx := context.Background()

	page, total, err := l.ListChildren(ctx, testNamespace, "parent", ChildFolder, 0, 2)
	require.NoError(t, err)
	require.Equal(t, []Child{{ChildFolder, "f1"}, {ChildFolder, "f2"}}, page)
	require.Equal(t, int64(3), total)

	page, total, err = l.ListChildren(ctx, testNamespace, "parent", ChildFolder, 2, 2)
	require.NoError(t, err)
	require.Equal(t, []Child{{ChildFolder, "f3"}}, page)
	require.Equal(t, int64(3), total)

	page, total, err = l.ListChildren(ctx, testNamespace, "parent", ChildDashboard, 0, 100)
	require.NoError(t, err)
	require.Equal(t, []Child{{ChildDashboard, "d1"}, {ChildDashboard, "d2"}}, page)
	require.Equal(t, int64(2), total)

	require.Len(t, s.requests, 3)
	for _, req := range s.requests {
		require.Equal(t, testNamespace, req.Options.Key.Namespace)
		require.Len(t, req.Options.Fields, 1)
		require.Equal(t, resource.SEARCH_FIELD_FOLDER, req.Options.Fields[0].Key)
		require.Equal(t, []string{"parent"}, req.Options.Fields[0].Values)
	}
	require.Equal(t, folderGVR.Resource, s.requests[1].Options.Key.Resource)
	require.Equal(t, int64(2), s.requests[1].Offset)
	require.Equal(t, int64(2), s.requests[1].Limit)
	require.Equal(t, dashboardGVR.Resource, s.requests[2].Options.Key.Resource)
}

func TestSearchChildLister_Error(t *testing.T) {
	_, _, err := NewSearchChildLister(&pagedSearcher{err: errors.New("index down")}).ListChildren(context.Background(), testNamespace, "parent", ChildFolder, 0, 10)
	require.ErrorContains(t, err, "index down")
}

func TestSearchChildLister_RejectsUnexpectedResultFormat(t *testing.T) {
	// A response in another format must not read as an empty folder, which would release it.
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_ResultFormat(99),
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
	} {
		s := &pagedSearcher{byResource: map[string][]string{}, format: format}
		_, _, err := NewSearchChildLister(s).ListChildren(context.Background(), testNamespace, "parent", ChildDashboard, 0, 10)
		require.ErrorContains(t, err, "unexpected search result format")
	}
}

func TestDynamicClients_Get(t *testing.T) {
	dyn := newFake(unstructuredFolder("c", true, foldersv1.CascadeDeleteFinalizer))
	clients := NewDynamicClients(dyn)

	f, err := clients.Get(context.Background(), testNamespace, "c")
	require.NoError(t, err)
	require.Equal(t, "c", f.Name)
	require.Equal(t, testNamespace, f.Namespace)
	require.NotNil(t, f.DeletionTimestamp)
	require.Equal(t, []string{foldersv1.CascadeDeleteFinalizer}, f.Finalizers)
	require.Equal(t, testParent, f.Annotations[utils.AnnoKeyFolder])

	_, err = clients.Get(context.Background(), testNamespace, "missing")
	require.True(t, apierrors.IsNotFound(err), "got %v", err)
}
