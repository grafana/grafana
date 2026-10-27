package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
)

const aggregatedDiscoveryContentType = "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList"

func newTestDiscoveryClient(t *testing.T, groups ...apidiscoveryv2.APIGroupDiscovery) *DiscoveryClientImpl {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := apidiscoveryv2.APIGroupDiscoveryList{
			TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
		}
		if r.URL.Path == "/apis" {
			list.Items = groups
		}
		w.Header().Set("Content-Type", aggregatedDiscoveryContentType)
		_ = json.NewEncoder(w).Encode(list)
	}))
	t.Cleanup(server.Close)

	c, err := NewDiscoveryClient(&rest.Config{Host: server.URL})
	require.NoError(t, err)
	return c
}

func discoveryGroup(name, version string, freshness apidiscoveryv2.DiscoveryFreshness, resources ...apidiscoveryv2.APIResourceDiscovery) apidiscoveryv2.APIGroupDiscovery {
	return apidiscoveryv2.APIGroupDiscovery{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Versions: []apidiscoveryv2.APIVersionDiscovery{{
			Version:   version,
			Freshness: freshness,
			Resources: resources,
		}},
	}
}

func discoveryResource(resource, kind string) apidiscoveryv2.APIResourceDiscovery {
	return apidiscoveryv2.APIResourceDiscovery{
		Resource:     resource,
		ResponseKind: &metav1.GroupVersionKind{Kind: kind},
		Scope:        apidiscoveryv2.ScopeNamespace,
		Verbs:        []string{"get", "list"},
	}
}
