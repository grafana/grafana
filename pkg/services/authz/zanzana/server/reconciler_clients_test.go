package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync/atomic"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
	clienttesting "k8s.io/client-go/testing"

	"github.com/grafana/grafana/pkg/services/apiserver"
)

func TestReconcilerClients(t *testing.T) {
	folders := schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1", Resource: "folders"}
	teams := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "teams"}
	settings := schema.GroupVersionResource{Group: "setting.grafana.app", Version: "v1beta1", Resource: "settings"}

	t.Run("reuses one client per API group", func(t *testing.T) {
		var calls atomic.Int32
		c := &reconcilerClients{byGroup: map[string]apiserver.RestConfigProvider{
			folders.Group: countingRestConfig(&calls, newDiscoveryServer(t, folders), 0),
		}}

		for _, namespace := range []string{"stacks-1", "stacks-2"} {
			_, err := c.ForResource(t.Context(), namespace, folders)
			require.NoError(t, err)
		}
		assert.Equal(t, int32(1), calls.Load())
	})

	t.Run("uses one loopback client for every API group", func(t *testing.T) {
		var calls atomic.Int32
		c := &reconcilerClients{loopback: countingRestConfig(&calls, newDiscoveryServer(t, folders, teams), 0)}

		for _, gvr := range []schema.GroupVersionResource{folders, teams} {
			_, err := c.ForResource(t.Context(), "stacks-1", gvr)
			require.NoError(t, err)
		}
		assert.Equal(t, int32(1), calls.Load())
	})

	t.Run("tries the client setup again after a failure", func(t *testing.T) {
		var calls atomic.Int32
		c := &reconcilerClients{loopback: countingRestConfig(&calls, newDiscoveryServer(t, folders), 1)}

		_, err := c.ForResource(t.Context(), "stacks-1", folders)
		require.Error(t, err)
		_, err = c.ForResource(t.Context(), "stacks-1", folders)
		require.NoError(t, err)
		assert.Equal(t, int32(2), calls.Load())
	})

	t.Run("fails for an API group without a server", func(t *testing.T) {
		var calls atomic.Int32
		c := &reconcilerClients{byGroup: map[string]apiserver.RestConfigProvider{
			folders.Group: countingRestConfig(&calls, newDiscoveryServer(t, folders), 0),
		}}

		_, err := c.ForResource(t.Context(), "stacks-1", settings)
		require.ErrorContains(t, err, "no client for API group setting.grafana.app")
		assert.Zero(t, calls.Load())
	})

	t.Run("fails when the server does not serve the resource", func(t *testing.T) {
		var calls atomic.Int32
		c := &reconcilerClients{loopback: countingRestConfig(&calls, newDiscoveryServer(t, folders), 0)}

		_, err := c.ForResource(t.Context(), "stacks-1", settings)
		require.Error(t, err)
	})
}

func TestRetryingList(t *testing.T) {
	unavailable := apierrors.NewServiceUnavailable("unavailable")

	t.Run("retries temporary errors", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			client, calls := listClient(unavailable, unavailable)

			list, err := retryingList{client}.List(t.Context(), metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, list)
			assert.Equal(t, int32(3), calls.Load())
		})
	})

	t.Run("stops after six attempts", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			client, calls := listClient(slices.Repeat([]error{unavailable}, 10)...)

			_, err := retryingList{client}.List(t.Context(), metav1.ListOptions{})
			require.True(t, apierrors.IsServiceUnavailable(err))
			assert.Equal(t, int32(6), calls.Load())
		})
	})

	t.Run("does not retry other errors", func(t *testing.T) {
		client, calls := listClient(apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, ""))

		_, err := retryingList{client}.List(t.Context(), metav1.ListOptions{})
		require.True(t, apierrors.IsNotFound(err))
		assert.Equal(t, int32(1), calls.Load())
	})

	t.Run("returns a cancel error", func(t *testing.T) {
		client, calls := listClient(context.Canceled)

		list, err := retryingList{client}.List(t.Context(), metav1.ListOptions{})
		require.ErrorIs(t, err, context.Canceled)
		assert.Nil(t, list)
		assert.Equal(t, int32(1), calls.Load())
	})
}

func newDiscoveryServer(t *testing.T, served ...schema.GroupVersionResource) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIResourceList{TypeMeta: metav1.TypeMeta{Kind: "APIResourceList", APIVersion: "v1"}}
		for _, gvr := range served {
			if r.URL.Path == "/apis/"+gvr.GroupVersion().String() {
				list.GroupVersion = gvr.GroupVersion().String()
				list.APIResources = append(list.APIResources, metav1.APIResource{Name: gvr.Resource, Kind: "Test", Namespaced: true, Verbs: []string{"list"}})
			}
		}
		if list.GroupVersion == "" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(list)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func countingRestConfig(calls *atomic.Int32, host string, failures int32) apiserver.RestConfigProvider {
	return apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
		if calls.Add(1) <= failures {
			return nil, errors.New("rest config not ready")
		}
		return &rest.Config{Host: host}, nil
	})
}

func listClient(errs ...error) (dynamic.ResourceInterface, *atomic.Int32) {
	gvr := schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1", Resource: "folders"}
	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{gvr: "FolderList"})
	calls := &atomic.Int32{}
	client.PrependReactor("list", gvr.Resource, func(clienttesting.Action) (bool, runtime.Object, error) {
		if n := calls.Add(1); int(n) <= len(errs) {
			return true, nil, errs[n-1]
		}
		return false, nil, nil
	})
	return client.Resource(gvr).Namespace("stacks-1"), calls
}
