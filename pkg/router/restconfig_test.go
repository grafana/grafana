package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type recordingExchanger struct {
	requests []authnlib.TokenExchangeRequest
}

func (e *recordingExchanger) Exchange(_ context.Context, r authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	e.requests = append(e.requests, r)
	return &authnlib.TokenExchangeResponse{Token: "exchanged-token"}, nil
}

// provisioningRepositories returns a client for the provisioning API behind a router that proxies it to a backend,
// as the router does for a remote service, and the headers the backend receives.
func provisioningRepositories(t *testing.T, exchanger authnlib.TokenExchanger) (dynamic.NamespaceableResourceInterface, <-chan http.Header) {
	t.Helper()
	requests := make(chan http.Header, 1)
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"apiVersion":"provisioning.grafana.app/v0alpha1","kind":"Repository","metadata":{"name":"my-repo","namespace":"stacks-5457"}}`))
	}))
	t.Cleanup(backend.Close)
	proxy, err := proxyBackend(t, "provisioning.grafana.app", backend.URL, backend.Client().Transport).Load(t.Context())
	require.NoError(t, err)
	router := withGroups("provisioning.grafana.app")
	router.served["provisioning.grafana.app"].handler = proxy
	router.publish(t.Context())
	provider := NewLoopbackRestConfigProvider(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		router.HandleFunc(w, r)
	}), exchanger)
	cfg, err := provider.GetRestConfig(t.Context())
	require.NoError(t, err)
	client, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	return client.Resource(schema.GroupVersionResource{Group: "provisioning.grafana.app", Version: "v0alpha1", Resource: "repositories"}), requests
}

// A service identity is built in memory. When the router forwards its request to a remote backend,
// the backend can only authenticate it if the request carries credentials.
func TestLoopbackRestConfigProviderServiceIdentity(t *testing.T) {
	for name, withIdentity := range map[string]func(context.Context) context.Context{
		"service": func(ctx context.Context) context.Context {
			return identity.WithServiceIdentityForSingleNamespaceContext(ctx, "stacks-5457")
		},
		"provisioning": func(ctx context.Context) context.Context {
			ctx, _, err := identity.WithProvisioningIdentity(ctx, "stacks-5457")
			require.NoError(t, err)
			return ctx
		},
	} {
		t.Run(name, func(t *testing.T) {
			exchanger := &recordingExchanger{}
			repositories, requests := provisioningRepositories(t, exchanger)

			_, err := repositories.Namespace("stacks-5457").Get(withIdentity(t.Context()), "my-repo", metav1.GetOptions{})
			require.NoError(t, err)

			headers := <-requests
			require.Equal(t, "Bearer exchanged-token", headers.Get("Authorization"))
			require.Equal(t, "Bearer exchanged-token", headers.Get("X-Access-Token"))
			require.Len(t, exchanger.requests, 1)
			require.Equal(t, "stacks-5457", exchanger.requests[0].Namespace)
			require.Equal(t, []string{"provisioning.grafana.app"}, exchanger.requests[0].Audiences)
			require.NotNil(t, exchanger.requests[0].ExpiresIn)
			require.Equal(t, serviceTokenExpiry, *exchanger.requests[0].ExpiresIn)
		})
	}
}

// A service identity for one namespace cannot sign a token for another one.
func TestLoopbackRestConfigProviderServiceIdentityOtherNamespace(t *testing.T) {
	exchanger := &recordingExchanger{}
	repositories, _ := provisioningRepositories(t, exchanger)

	ctx := identity.WithServiceIdentityForSingleNamespaceContext(t.Context(), "stacks-5457")
	_, err := repositories.Namespace("stacks-9999").Get(ctx, "my-repo", metav1.GetOptions{})
	require.Error(t, err)
	require.Empty(t, exchanger.requests)
}

// Only a service identity gets a service token. A user without tokens must not gain service access.
func TestLoopbackRestConfigProviderExchangesOnlyForServiceIdentity(t *testing.T) {
	exchanger := &recordingExchanger{}
	repositories, requests := provisioningRepositories(t, exchanger)

	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-5457"})
	_, err := repositories.Namespace("stacks-5457").Get(ctx, "my-repo", metav1.GetOptions{})
	require.NoError(t, err)
	headers := <-requests
	require.Empty(t, headers.Get("Authorization"))
	require.Empty(t, exchanger.requests)
}

func TestRequestGroupAndNamespace(t *testing.T) {
	for path, want := range map[string][2]string{
		"/apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/r": {"provisioning.grafana.app", "stacks-1"},
		"/apis/folder.grafana.app/v1/folders":                                        {"folder.grafana.app", ""},
		"/apis/folder.grafana.app":                                                   {"", ""},
		"/api/folders":                                                               {"", ""},
		"/":                                                                          {"", ""},
	} {
		group, namespace := requestGroupAndNamespace(path)
		require.Equal(t, want, [2]string{group, namespace}, path)
	}
}

func TestLoopbackRestConfigProvider(t *testing.T) {
	requests := make(chan http.Header, 2)
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"apiVersion":"folder.grafana.app/v1","kind":"Folder","metadata":{"name":"fw9lwk","namespace":"stacks-5457"}}`))
	}))
	defer backend.Close()
	proxy, err := proxyBackend(t, "folder.grafana.app", backend.URL, backend.Client().Transport).Load(t.Context())
	require.NoError(t, err)
	router := withGroups("folder.grafana.app")
	router.served["folder.grafana.app"].handler = proxy
	router.publish(t.Context())
	provider := NewLoopbackRestConfigProvider(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		router.HandleFunc(w, r)
	}), nil)
	cfg, err := provider.GetRestConfig(t.Context())
	require.NoError(t, err)
	restClient, err := clientrest.UnversionedRESTClientFor(dynamic.ConfigFor(cfg))
	require.NoError(t, err)
	require.Nil(t, restClient.GetRateLimiter(), "folder lookups must not share a client-side rate limiter")
	client, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	folders := client.Resource(schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1", Resource: "folders"}).Namespace("stacks-5457")
	for _, token := range []string{"first-caller", "second-caller"} {
		ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-5457", AccessToken: token, IDToken: "id-" + token})
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
		identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-5457"}), "fw9lwk", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "%v", err)
}
