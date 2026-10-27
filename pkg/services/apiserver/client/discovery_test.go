package client

import (
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
