package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
)

func TestDiscoveryClient_GetPreferredVersion(t *testing.T) {
	playlists := discoveryResource("playlists", "Playlist")
	tests := []struct {
		name    string
		groups  []apidiscoveryv2.APIGroupDiscovery
		wantGVR schema.GroupVersionResource
		wantGVK schema.GroupVersionKind
		wantErr string
	}{
		{
			name: "all groups current",
			groups: []apidiscoveryv2.APIGroupDiscovery{
				discoveryGroup("playlist.grafana.app", "v1", apidiscoveryv2.DiscoveryFreshnessCurrent, playlists),
			},
			wantGVR: schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v1", Resource: "playlists"},
			wantGVK: schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v1", Kind: "Playlist"},
		},
		{
			name: "another group stale",
			groups: []apidiscoveryv2.APIGroupDiscovery{
				discoveryGroup("playlist.grafana.app", "v1", apidiscoveryv2.DiscoveryFreshnessCurrent, playlists),
				discoveryGroup("myorg-withbackend-app", "v0alpha1", apidiscoveryv2.DiscoveryFreshnessStale),
			},
			wantGVR: schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v1", Resource: "playlists"},
			wantGVK: schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v1", Kind: "Playlist"},
		},
		{
			name: "target group stale",
			groups: []apidiscoveryv2.APIGroupDiscovery{
				discoveryGroup("playlist.grafana.app", "v1", apidiscoveryv2.DiscoveryFreshnessStale),
			},
			wantErr: "stale GroupVersion discovery: playlist.grafana.app/v1",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newTestDiscoveryClient(t, tt.groups...)

			gvr, gvk, err := c.GetPreferredVersion(schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"})
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantGVR, gvr)
				require.Equal(t, tt.wantGVK, gvk)
			}

			gvr, gvk, err = c.GetPreferredVersionForKind(schema.GroupKind{Group: "playlist.grafana.app", Kind: "Playlist"})
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantGVR, gvr)
				require.Equal(t, tt.wantGVK, gvk)
			}
		})
	}
}

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
