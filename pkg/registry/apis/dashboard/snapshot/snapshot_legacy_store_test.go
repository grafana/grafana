package snapshot

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ctxForOrg returns a context whose namespace resolves to the given org, mirroring
// how the apiserver sets the namespace before reaching the store.
func ctxForOrg(orgID int64) context.Context {
	return k8srequest.WithNamespace(context.Background(), authlib.OrgNamespaceFormatter(orgID))
}

func setExternalSnapshotsK8SAPIPushToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagExternalSnapshotsK8SAPIPush: {
			Key:            featuremgmt.FlagExternalSnapshotsK8SAPIPush,
			DefaultVariant: variant,
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
		// The k8s snapshot routes require kubernetesSnapshots; enable it so the
		// external-push behavior under test is actually reached.
		featuremgmt.FlagKubernetesSnapshots: {
			Key:            featuremgmt.FlagKubernetesSnapshots,
			DefaultVariant: "enabled",
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

func TestSnapshotLegacyStore_Delete_External(t *testing.T) {
	const deleteKey = "abc123"

	makeStore := func(t *testing.T, externalDeleteURL string) *SnapshotLegacyStore {
		mockService := dashboardsnapshots.NewMockService(t)
		mockService.On("GetDashboardSnapshot", mock.Anything, mock.Anything).
			Return(&dashboardsnapshots.DashboardSnapshot{
				Key:               "snap-1",
				DeleteKey:         deleteKey,
				OrgID:             1,
				External:          true,
				ExternalDeleteURL: externalDeleteURL,
			}, nil)
		// Local delete is only reached after a successful external delete; mark optional
		// so the invalid-URL case (which errors before this) doesn't fail mock assertions.
		mockService.On("DeleteDashboardSnapshot", mock.Anything, mock.Anything).Return(nil).Maybe()

		return &SnapshotLegacyStore{
			ResourceInfo:          dashV0.SnapshotResourceInfo,
			Service:               mockService,
			ExternalSnapshotToken: "test-token",
		}
	}

	t.Run("with externalSnapshotsK8SAPIPush ON sends DELETE to new k8s endpoint", func(t *testing.T) {
		setExternalSnapshotsK8SAPIPushToggle(t, true)

		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		// Stored ExternalDeleteURL has the new k8s path; the legacy store should rebuild
		// the URL from the domain + deleteKey rather than using it as-is.
		store := makeStore(t, server.URL+"/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/"+deleteKey)

		_, _, err := store.Delete(ctxForOrg(1), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.NotNil(t, receivedReq)
		assert.Equal(t, http.MethodDelete, receivedReq.Method)
		assert.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/"+deleteKey, receivedReq.URL.Path)
		assert.Equal(t, "Bearer test-token", receivedReq.Header.Get("Authorization"))
	})

	t.Run("with externalSnapshotsK8SAPIPush OFF sends GET to legacy endpoint", func(t *testing.T) {
		setExternalSnapshotsK8SAPIPushToggle(t, false)

		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		store := makeStore(t, server.URL+"/api/snapshots-delete/"+deleteKey)

		_, _, err := store.Delete(ctxForOrg(1), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.NotNil(t, receivedReq)
		assert.Equal(t, http.MethodGet, receivedReq.Method)
		assert.Equal(t, "/api/snapshots-delete/"+deleteKey, receivedReq.URL.Path)
		assert.Empty(t, receivedReq.Header.Get("Authorization"))
	})

	t.Run("rebuilds URL using domain from ExternalDeleteURL even when stored path is wrong", func(t *testing.T) {
		setExternalSnapshotsK8SAPIPushToggle(t, true)

		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		// Stored URL has a stale/wrong legacy path; with the toggle ON the store should
		// extract just the domain and rebuild the new k8s path.
		store := makeStore(t, server.URL+"/api/snapshots-delete/"+deleteKey)

		_, _, err := store.Delete(ctxForOrg(1), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.NotNil(t, receivedReq)
		assert.Equal(t, http.MethodDelete, receivedReq.Method)
		assert.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/"+deleteKey, receivedReq.URL.Path)
	})

	t.Run("returns error on invalid ExternalDeleteURL", func(t *testing.T) {
		setExternalSnapshotsK8SAPIPushToggle(t, true)

		store := makeStore(t, "not-a-url")

		_, _, err := store.Delete(ctxForOrg(1), "snap-1", nil, &metav1.DeleteOptions{})
		require.Error(t, err)
	})
}

// Snapshots are org-scoped but the store looks them up by global key. A caller in
// one org must not be able to delete a snapshot owned by another org.
func TestSnapshotLegacyStore_Delete_CrossOrg(t *testing.T) {
	mockService := dashboardsnapshots.NewMockService(t)
	mockService.On("GetDashboardSnapshot", mock.Anything, mock.Anything).
		Return(&dashboardsnapshots.DashboardSnapshot{
			Key:       "snap-1",
			DeleteKey: "abc123",
			OrgID:     1,
		}, nil)
	// The delete must never be reached for a cross-org target.
	mockService.On("DeleteDashboardSnapshot", mock.Anything, mock.Anything).
		Return(nil).
		Run(func(mock.Arguments) { t.Fatal("DeleteDashboardSnapshot should not be called for a cross-org snapshot") }).
		Maybe()

	store := &SnapshotLegacyStore{
		ResourceInfo: dashV0.SnapshotResourceInfo,
		Service:      mockService,
	}

	// Caller is in org 2, snapshot belongs to org 1.
	_, deleted, err := store.Delete(ctxForOrg(2), "snap-1", nil, &metav1.DeleteOptions{})
	require.Error(t, err)
	assert.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
	assert.False(t, deleted)
}

func TestSnapshotLegacyStore_List_DeleteKey(t *testing.T) {
	const deleteKey = "abc123"

	makeStore := func(t *testing.T) *SnapshotLegacyStore {
		mockService := dashboardsnapshots.NewMockService(t)
		mockService.On("GetDashboardSnapshot", mock.Anything, &dashboardsnapshots.GetDashboardSnapshotQuery{DeleteKey: deleteKey}).
			Return(&dashboardsnapshots.DashboardSnapshot{
				Key:       "snap-1",
				DeleteKey: deleteKey,
				OrgID:     1,
				Dashboard: simplejson.New(),
			}, nil)
		return &SnapshotLegacyStore{
			ResourceInfo: dashV0.SnapshotResourceInfo,
			Service:      mockService,
			Namespacer:   authlib.OrgNamespaceFormatter,
		}
	}

	listByDeleteKey := func(ctx context.Context, store *SnapshotLegacyStore) (*dashV0.SnapshotList, error) {
		obj, err := store.List(ctx, &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.deleteKey", deleteKey),
		})
		if err != nil {
			return nil, err
		}
		list, ok := obj.(*dashV0.SnapshotList)
		require.True(t, ok)
		return list, nil
	}

	t.Run("returns the snapshot for a same-org caller", func(t *testing.T) {
		store := makeStore(t)
		list, err := listByDeleteKey(ctxForOrg(1), store)
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		assert.Equal(t, "snap-1", list.Items[0].Name)
	})

	t.Run("returns an empty list for a cross-org caller", func(t *testing.T) {
		store := makeStore(t)
		list, err := listByDeleteKey(ctxForOrg(2), store)
		require.NoError(t, err)
		assert.Empty(t, list.Items)
	})
}
