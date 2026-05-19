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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func setKubernetesSnapshotsToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesSnapshots: {
			Key:            featuremgmt.FlagKubernetesSnapshots,
			DefaultVariant: variant,
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

	t.Run("with kubernetesSnapshots ON sends DELETE to new k8s endpoint", func(t *testing.T) {
		setKubernetesSnapshotsToggle(t, true)

		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		// Stored ExternalDeleteURL has the new k8s path; the legacy store should rebuild
		// the URL from the domain + deleteKey rather than using it as-is.
		store := makeStore(t, server.URL+"/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/"+deleteKey)

		_, _, err := store.Delete(context.Background(), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.NotNil(t, receivedReq)
		assert.Equal(t, http.MethodDelete, receivedReq.Method)
		assert.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/"+deleteKey, receivedReq.URL.Path)
		assert.Equal(t, "Bearer test-token", receivedReq.Header.Get("Authorization"))
	})

	t.Run("with kubernetesSnapshots OFF sends GET to legacy endpoint", func(t *testing.T) {
		setKubernetesSnapshotsToggle(t, false)

		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		store := makeStore(t, server.URL+"/api/snapshots-delete/"+deleteKey)

		_, _, err := store.Delete(context.Background(), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.NotNil(t, receivedReq)
		assert.Equal(t, http.MethodGet, receivedReq.Method)
		assert.Equal(t, "/api/snapshots-delete/"+deleteKey, receivedReq.URL.Path)
		assert.Empty(t, receivedReq.Header.Get("Authorization"))
	})

	t.Run("rebuilds URL using domain from ExternalDeleteURL even when stored path is wrong", func(t *testing.T) {
		setKubernetesSnapshotsToggle(t, true)

		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		// Stored URL has a stale/wrong legacy path; with the toggle ON the store should
		// extract just the domain and rebuild the new k8s path.
		store := makeStore(t, server.URL+"/api/snapshots-delete/"+deleteKey)

		_, _, err := store.Delete(context.Background(), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.NotNil(t, receivedReq)
		assert.Equal(t, http.MethodDelete, receivedReq.Method)
		assert.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/"+deleteKey, receivedReq.URL.Path)
	})

	t.Run("returns error on invalid ExternalDeleteURL", func(t *testing.T) {
		setKubernetesSnapshotsToggle(t, true)

		store := makeStore(t, "not-a-url")

		_, _, err := store.Delete(context.Background(), "snap-1", nil, &metav1.DeleteOptions{})
		require.Error(t, err)
	})
}
