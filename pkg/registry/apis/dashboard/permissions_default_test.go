package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	authlib "github.com/grafana/authlib/types"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestClearCreatorPermissionCache(t *testing.T) {
	t.Run("clears cache for user identities", func(t *testing.T) {
		ac := mock.New()
		b := &DashboardsAPIBuilder{acService: ac}
		u := &user.SignedInUser{UserID: 1, OrgID: 1, Login: "creator"}
		ctx := identity.WithRequester(context.Background(), u)

		b.clearCreatorPermissionCache(ctx)

		require.Len(t, ac.Calls.ClearUserPermissionCache, 1)
	})

	t.Run("no-ops when acService is nil", func(t *testing.T) {
		b := &DashboardsAPIBuilder{}
		u := &user.SignedInUser{UserID: 1, OrgID: 1, Login: "creator"}
		ctx := identity.WithRequester(context.Background(), u)

		require.NotPanics(t, func() {
			b.clearCreatorPermissionCache(ctx)
		})
	})

	t.Run("skips anonymous identities", func(t *testing.T) {
		ac := mock.New()
		b := &DashboardsAPIBuilder{acService: ac}
		u := &user.SignedInUser{IsAnonymous: true, OrgID: 1}
		ctx := identity.WithRequester(context.Background(), u)

		b.clearCreatorPermissionCache(ctx)

		require.Empty(t, ac.Calls.ClearUserPermissionCache)
	})
}

func TestSetDefaultDashboardPermissions_RootCheck(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-1"}
	creator := &user.SignedInUser{UserID: 1, OrgID: 1, Login: "creator", Name: "1"}

	t.Run("skips nested dashboards without calling the permissions API", func(t *testing.T) {
		fake := &recordingResourceClient{panicOnCall: true}
		var iface dynamic.NamespaceableResourceInterface = fake
		b := &DashboardsAPIBuilder{resourcePermissionsSvc: &iface}

		dash := &dashv1.Dashboard{ObjectMeta: metav1.ObjectMeta{Name: "dash-1", Namespace: "default"}}
		dash.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "some-folder"})
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)

		err = b.setDefaultDashboardPermissions(context.Background(), key, creator, meta)
		require.NoError(t, err)
	})

	t.Run("seeds permissions for empty folder and clears creator cache", func(t *testing.T) {
		ac := mock.New()
		fake := &recordingResourceClient{getNotFound: true}
		var iface dynamic.NamespaceableResourceInterface = fake
		b := &DashboardsAPIBuilder{resourcePermissionsSvc: &iface, acService: ac}

		dash := &dashv1.Dashboard{ObjectMeta: metav1.ObjectMeta{Name: "dash-1", Namespace: "default"}}
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		require.True(t, folder.IsRootFolderUID(meta.GetFolder()))

		ctx := identity.WithRequester(context.Background(), creator)
		err = b.setDefaultDashboardPermissions(ctx, key, creator, meta)
		require.NoError(t, err)
		require.Equal(t, 1, fake.createCalls)
		require.Len(t, ac.Calls.ClearUserPermissionCache, 1)
	})

	t.Run("seeds permissions for general folder and clears creator cache", func(t *testing.T) {
		ac := mock.New()
		fake := &recordingResourceClient{getNotFound: true}
		var iface dynamic.NamespaceableResourceInterface = fake
		b := &DashboardsAPIBuilder{resourcePermissionsSvc: &iface, acService: ac}

		dash := &dashv1.Dashboard{ObjectMeta: metav1.ObjectMeta{Name: "dash-1", Namespace: "default"}}
		dash.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folder.GeneralFolderUID})
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		require.True(t, folder.IsRootFolderUID(meta.GetFolder()))

		ctx := identity.WithRequester(context.Background(), creator)
		err = b.setDefaultDashboardPermissions(ctx, key, creator, meta)
		require.NoError(t, err)
		require.Equal(t, 1, fake.createCalls)
		require.Len(t, ac.Calls.ClearUserPermissionCache, 1)
	})
}

// recordingResourceClient is a minimal dynamic client stub for default-permission tests.
type recordingResourceClient struct {
	panicOnCall bool
	getNotFound bool
	createCalls int
	updateCalls int
}

func (r *recordingResourceClient) Namespace(string) dynamic.ResourceInterface {
	if r.panicOnCall {
		panic("permissions API should not be called for nested dashboards")
	}
	return r
}

func (r *recordingResourceClient) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	r.createCalls++
	return obj, nil
}

func (r *recordingResourceClient) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	r.updateCalls++
	return obj, nil
}

func (r *recordingResourceClient) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}

func (r *recordingResourceClient) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	return nil
}

func (r *recordingResourceClient) DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	return nil
}

func (r *recordingResourceClient) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if r.getNotFound {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: "iam.grafana.app", Resource: "resourcepermissions"}, name)
	}
	return &unstructured.Unstructured{}, nil
}

func (r *recordingResourceClient) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return &unstructured.UnstructuredList{}, nil
}

func (r *recordingResourceClient) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	return watch.NewFake(), nil
}

func (r *recordingResourceClient) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, nil
}

func (r *recordingResourceClient) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, nil
}

func (r *recordingResourceClient) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}

// Ensure SignedInUser satisfies AuthInfo for buildDefaultDashboardPermissions.
var _ authlib.AuthInfo = (*user.SignedInUser)(nil)
