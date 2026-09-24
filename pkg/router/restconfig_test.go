package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestLoopbackRestConfigProvider(t *testing.T) {
	requests := make(chan http.Header, 2)
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"apiVersion":"folder.grafana.app/v1","kind":"Folder","metadata":{"name":"fw9lwk","namespace":"stacks-5457"}}`))
	}))
	defer backend.Close()
	forward, err := NewForwardBackend(metav1.APIGroup{Name: "folder.grafana.app"}, forwardSpec(backend.URL), "1", backend.Client().Transport.(*http.Transport))
	require.NoError(t, err)
	proxy, err := forward.Load(t.Context())
	require.NoError(t, err)
	router := withGroups("folder.grafana.app")
	router.served["folder.grafana.app"].handler = proxy
	router.publish()
	provider := NewLoopbackRestConfigProvider(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		router.HandleFunc(w, r, http.NotFoundHandler())
	}))
	cfg, err := provider.GetRestConfig(t.Context())
	require.NoError(t, err)
	restClient, err := clientrest.UnversionedRESTClientFor(dynamic.ConfigFor(cfg))
	require.NoError(t, err)
	require.Nil(t, restClient.GetRateLimiter(), "folder lookups must not share a client-side rate limiter")
	client, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	folders := client.Resource(schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1", Resource: "folders"}).Namespace("stacks-5457")
	for _, token := range []string{"first-caller", "second-caller"} {
		ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeUser, AccessToken: token, IDToken: "id-" + token})
		folder, err := folders.Get(ctx, "fw9lwk", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "fw9lwk", folder.GetName())
		headers := <-requests
		require.Equal(t, "Bearer "+token, headers.Get("X-Access-Token"))
		require.Equal(t, "Bearer "+token, headers.Get("Authorization"))
		require.Equal(t, "id-"+token, headers.Get("X-Grafana-Id"))
	}
	_, err = folders.Get(t.Context(), "fw9lwk", metav1.GetOptions{})
	require.Error(t, err, "missing identity must not reuse another caller's credentials")
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = folders.Get(ctx, "fw9lwk", metav1.GetOptions{})
	require.ErrorIs(t, err, context.Canceled)
	_, err = client.Resource(schema.GroupVersionResource{Group: "missing.grafana.app", Version: "v1", Resource: "folders"}).Namespace("stacks-5457").Get(
		identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeUser}), "fw9lwk", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "%v", err)
}
