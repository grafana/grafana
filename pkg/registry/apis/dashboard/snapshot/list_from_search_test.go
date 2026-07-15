package snapshot

import (
	"context"
	"encoding/binary"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// fakeIndex captures the search request and returns a canned response.
type fakeIndex struct {
	resourcepb.ResourceIndexClient
	called bool
	req    *resourcepb.ResourceSearchRequest
	resp   *resourcepb.ResourceSearchResponse
}

func (f *fakeIndex) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	f.called = true
	f.req = in
	if f.resp == nil {
		return &resourcepb.ResourceSearchResponse{}, nil
	}
	return f.resp, nil
}

// fakeInner is a minimal rest.Storage + rest.Lister used to verify delegation.
type fakeInner struct {
	listCalled bool
	listResp   runtime.Object
}

func (f *fakeInner) New() runtime.Object     { return &dashv0.Snapshot{} }
func (f *fakeInner) Destroy()                {}
func (f *fakeInner) NewList() runtime.Object { return &dashv0.SnapshotList{} }
func (f *fakeInner) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	f.listCalled = true
	return f.listResp, nil
}
func (f *fakeInner) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return nil, nil
}

func i64Cell(v int64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, uint64(v))
	return b
}

func ctxWithRequester(r identity.Requester) context.Context {
	return identity.WithRequester(context.Background(), r)
}

func TestListFromSearch_RBAC(t *testing.T) {
	createdByFilter := func(req *resourcepb.ResourceSearchRequest) *resourcepb.Requirement {
		if req == nil || req.Options == nil {
			return nil
		}
		for _, f := range req.Options.Fields {
			if f.Key == resource.SEARCH_FIELD_CREATED_BY {
				return f
			}
		}
		return nil
	}

	t.Run("admin gets no creator filter", func(t *testing.T) {
		idx := &fakeIndex{}
		w := &storageWrapper{index: idx}
		r := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "admin1", OrgRole: identity.RoleAdmin, Namespace: "default"}

		_, err := w.listFromSearch(ctxWithRequester(r), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.True(t, idx.called)
		require.Nil(t, createdByFilter(idx.req), "admin must not be scoped to their own snapshots")
		// namespace + group/resource scoping is always present
		require.Equal(t, "default", idx.req.Options.Key.Namespace)
		require.Equal(t, dashv0.SnapshotResourceInfo.GroupResource().Resource, idx.req.Options.Key.Resource)
	})

	t.Run("non-admin user is scoped to their own snapshots", func(t *testing.T) {
		idx := &fakeIndex{}
		w := &storageWrapper{index: idx}
		r := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "u42", OrgRole: identity.RoleEditor, Namespace: "default"}

		_, err := w.listFromSearch(ctxWithRequester(r), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.True(t, idx.called)
		f := createdByFilter(idx.req)
		require.NotNil(t, f)
		require.Equal(t, []string{r.GetUID()}, f.Values)
		require.Equal(t, "user:u42", r.GetUID())
	})

	t.Run("anonymous sees nothing and does not hit the index", func(t *testing.T) {
		idx := &fakeIndex{}
		w := &storageWrapper{index: idx}
		r := &identity.StaticRequester{Type: claims.TypeAnonymous, Namespace: "default"}

		obj, err := w.listFromSearch(ctxWithRequester(r), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.False(t, idx.called, "anonymous requests must not query the index")
		list, ok := obj.(*dashv0.SnapshotList)
		require.True(t, ok)
		require.Empty(t, list.Items)
	})
}

func TestListFromSearch_Reconstruction(t *testing.T) {
	cols := []*resourcepb.ResourceTableColumnDefinition{
		{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
		{Name: builders.SNAPSHOT_EXPIRES, Type: resourcepb.ResourceTableColumnDefinition_INT64},
		{Name: builders.SNAPSHOT_EXTERNAL, Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN},
		{Name: builders.SNAPSHOT_EXTERNAL_URL, Type: resourcepb.ResourceTableColumnDefinition_STRING},
		{Name: builders.SNAPSHOT_CREATED, Type: resourcepb.ResourceTableColumnDefinition_INT64},
	}
	const expiresMs = int64(1700000000000)
	const createdMs = int64(1699999999000)
	row := &resourcepb.ResourceTableRow{
		Key:             &resourcepb.ResourceKey{Namespace: "default", Group: dashv0.GROUP, Resource: "snapshots", Name: "snap-1"},
		ResourceVersion: 42,
		Cells: [][]byte{
			[]byte("My Snapshot"),
			i64Cell(expiresMs),
			{1},
			[]byte("http://ext/snap-1"),
			i64Cell(createdMs),
		},
	}

	idx := &fakeIndex{resp: &resourcepb.ResourceSearchResponse{
		ResourceVersion: 99,
		TotalHits:       1,
		Results:         &resourcepb.ResourceTable{Columns: cols, Rows: []*resourcepb.ResourceTableRow{row}},
	}}
	w := &storageWrapper{index: idx}
	r := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "admin1", OrgRole: identity.RoleAdmin, Namespace: "default"}

	obj, err := w.listFromSearch(ctxWithRequester(r), &internalversion.ListOptions{})
	require.NoError(t, err)
	list, ok := obj.(*dashv0.SnapshotList)
	require.True(t, ok)
	require.Equal(t, "99", list.ResourceVersion)
	require.Len(t, list.Items, 1)

	snap := list.Items[0]
	require.Equal(t, "snap-1", snap.Name)
	require.Equal(t, "default", snap.Namespace)
	require.Equal(t, "42", snap.ResourceVersion)
	require.NotNil(t, snap.Spec.Title)
	require.Equal(t, "My Snapshot", *snap.Spec.Title)
	require.NotNil(t, snap.Spec.Expires)
	require.Equal(t, expiresMs, *snap.Spec.Expires)
	require.NotNil(t, snap.Spec.External)
	require.True(t, *snap.Spec.External)
	require.NotNil(t, snap.Spec.ExternalUrl)
	require.Equal(t, "http://ext/snap-1", *snap.Spec.ExternalUrl)
	require.Equal(t, createdMs, snap.CreationTimestamp.UnixMilli())

	// The whole point: body and deleteKey are never populated from search.
	require.Nil(t, snap.Spec.Dashboard)
	require.Nil(t, snap.Spec.DeleteKey)
}

func TestListFromSearch_Pagination(t *testing.T) {
	cols := []*resourcepb.ResourceTableColumnDefinition{
		{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
	}
	rows := []*resourcepb.ResourceTableRow{
		{Key: &resourcepb.ResourceKey{Name: "a"}, Cells: [][]byte{[]byte("a")}},
		{Key: &resourcepb.ResourceKey{Name: "b"}, Cells: [][]byte{[]byte("b")}},
	}
	idx := &fakeIndex{resp: &resourcepb.ResourceSearchResponse{
		TotalHits: 5, // more than returned -> continue token expected
		Results:   &resourcepb.ResourceTable{Columns: cols, Rows: rows},
	}}
	w := &storageWrapper{index: idx}
	r := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "admin1", OrgRole: identity.RoleAdmin, Namespace: "default"}

	obj, err := w.listFromSearch(ctxWithRequester(r), &internalversion.ListOptions{Limit: 2, Continue: "2"})
	require.NoError(t, err)
	require.Equal(t, int64(2), idx.req.Limit)
	require.Equal(t, int64(2), idx.req.Offset)
	list := obj.(*dashv0.SnapshotList)
	require.Equal(t, "4", list.Continue) // offset(2) + len(2)
}

func TestList_DeleteKeySelector_DelegatesToInner(t *testing.T) {
	inner := &fakeInner{listResp: &dashv0.SnapshotList{Items: []dashv0.Snapshot{{
		Spec: dashv0.SnapshotSpec{DeleteKey: ptr("dk"), Dashboard: map[string]any{"x": 1}},
	}}}}
	idx := &fakeIndex{}
	w := &storageWrapper{inner: inner, index: idx}

	opts := &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.deleteKey", "dk")}
	obj, err := w.List(context.Background(), opts)
	require.NoError(t, err)
	require.True(t, inner.listCalled, "field-selector list must use inner storage")
	require.False(t, idx.called, "field-selector list must not query the index")

	// Delegated-list results are still stripped.
	list := obj.(*dashv0.SnapshotList)
	require.Len(t, list.Items, 1)
	require.Nil(t, list.Items[0].Spec.DeleteKey)
	require.Nil(t, list.Items[0].Spec.Dashboard)
}

func TestList_NilIndex_DelegatesToInner(t *testing.T) {
	inner := &fakeInner{listResp: &dashv0.SnapshotList{}}
	w := &storageWrapper{inner: inner, index: nil}

	_, err := w.List(context.Background(), &internalversion.ListOptions{})
	require.NoError(t, err)
	require.True(t, inner.listCalled)
}

func ptr[T any](v T) *T { return &v }
