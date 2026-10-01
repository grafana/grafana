package generic

import (
	"sort"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const usageInsightsOwner = "usageinsights.grafana.app"

var viewWindows = []string{"today", "last_7_days", "last_30_days", "total"}

func playlistKind(t *testing.T, version string) app.ManifestVersionKind {
	t.Helper()
	m := manifestdata.LocalManifest()
	require.NotNil(t, m.ManifestData)
	for _, v := range m.ManifestData.Versions {
		if v.Name != version {
			continue
		}
		for _, k := range v.Kinds {
			if k.Kind == "Playlist" {
				return k
			}
		}
	}
	require.FailNowf(t, "Playlist kind not found", "version %s", version)
	return app.ManifestVersionKind{}
}

// The playlist opt-in declares exactly the four views_* search fields,
// each sourced from the Usage Insights stats KV document, in both versions.
func TestPlaylistManifest_DeclaresKVSourcedViewFields(t *testing.T) {
	t.Parallel()

	for _, version := range []string{"v1", "v0alpha1"} {
		t.Run(version, func(t *testing.T) {
			t.Parallel()
			k := playlistKind(t, version)
			require.True(t, k.HasKV(), "Playlist must keep its kv subresource")

			got := map[string]app.ManifestVersionKindSearchField{}
			for _, f := range k.SearchFields {
				got[f.Name] = f
			}
			wantNames := make([]string, 0, len(viewWindows))
			for _, w := range viewWindows {
				wantNames = append(wantNames, "views_"+w)
			}
			gotNames := make([]string, 0, len(got))
			for n := range got {
				gotNames = append(gotNames, n)
			}
			sort.Strings(wantNames)
			sort.Strings(gotNames)
			require.Equal(t, wantNames, gotNames, "Playlist declares exactly the four views_* fields")

			for _, w := range viewWindows {
				f := got["views_"+w]
				assert.Equal(t, "int64", f.Type, f.Name)
				assert.ElementsMatch(t, []string{"sort", "retrieve"}, f.Capabilities, f.Name)
				assert.Empty(t, f.Path, "%s is KV-sourced, not path-sourced", f.Name)
				assert.False(t, f.Array, f.Name)
				src := f.KVSource()
				require.NotNil(t, src, "%s must carry source.kv", f.Name)
				assert.Equal(t, app.ManifestVersionKindSearchFieldKVSource{
					Owner: usageInsightsOwner, Key: "stats", Path: "views_" + w,
				}, *src, f.Name)
			}
		})
	}
}

func TestPlaylistManifest_ValidatesWithKVSources(t *testing.T) {
	t.Parallel()
	m := manifestdata.LocalManifest()
	require.NotNil(t, m.ManifestData)
	assert.NoError(t, m.ManifestData.Validate())
}

// The generic search layer sees the playlist's declared fields as KV-sourced
// straight from the generated manifest — no playlist-specific Go.
func TestPlaylistManifest_SearchProviderSeesKVSources(t *testing.T) {
	t.Parallel()
	m := manifestdata.LocalManifest()
	p, err := resource.ManifestBackedProvider(m.ManifestData)
	require.NoError(t, err)

	for _, version := range []string{"v1", "v0alpha1"} {
		fields := p.Fields(schema.GroupVersionResource{Group: "playlist.grafana.app", Version: version, Resource: "playlists"})
		kvSourced := map[string]resource.KVFieldSource{}
		for _, f := range fields {
			if f.IsKVSourced() {
				kvSourced[f.Name] = *f.KVSource
			}
		}
		want := map[string]resource.KVFieldSource{}
		for _, w := range viewWindows {
			want["views_"+w] = resource.KVFieldSource{Owner: usageInsightsOwner, Key: "stats", Path: "views_" + w}
		}
		assert.Equal(t, want, kvSourced, version)
	}

	providers, err := resource.SearchFieldProviders(m.ManifestData)
	require.NoError(t, err)
	reg := resource.NewSearchFieldsRegistry(nil, nil, providers)
	assert.Contains(t, reg.KVSourcedKinds(), resource.NewLowerGroupResource("playlist.grafana.app", "playlists"))
}
