package kv

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	okOwner = "usageinsights.grafana.app"
	okKey   = "stats"
)

func ownerKeyNames(items []ResourceKVItem) []string {
	names := make([]string, 0, len(items))
	for _, it := range items {
		names = append(names, it.Name)
	}
	sort.Strings(names)
	return names
}

func TestResourceKVStore_ScanNamespaceOwnerKey_OnlyMatchingEntries(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	const group, resource, ns = "playlist.grafana.app", "playlists", "default"
	p := func(name string) ResourceParent {
		return ResourceParent{Group: group, Resource: resource, Namespace: ns, Name: name}
	}

	saveJSON(t, store, p("p1"), okOwner, okKey, `{"views_total":1}`)
	saveJSON(t, store, p("p2"), okOwner, okKey, `{"views_total":2}`)
	// Same resource, other keys under the same owner — including prefix-sharing keys.
	saveJSON(t, store, p("p1"), okOwner, "daily", `{"v":1}`)
	saveJSON(t, store, p("p3"), okOwner, "stats2", `{"views_total":99}`)
	saveJSON(t, store, p("p4"), okOwner, "stats/sub", `{"views_total":99}`)
	// Same key, other owners — including a prefix-sharing owner.
	saveJSON(t, store, p("p5"), "other.grafana.app", okKey, `{"views_total":99}`)
	saveJSON(t, store, p("p6"), okOwner+"x", okKey, `{"views_total":99}`)
	// Same owner/key in another namespace, another resource and another group.
	saveJSON(t, store, ResourceParent{Group: group, Resource: resource, Namespace: "default2", Name: "p7"}, okOwner, okKey, `{}`)
	saveJSON(t, store, ResourceParent{Group: group, Resource: "playlists2", Namespace: ns, Name: "p8"}, okOwner, okKey, `{}`)
	saveJSON(t, store, ResourceParent{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: ns, Name: "p9"}, okOwner, okKey, `{}`)

	items, err := store.ScanNamespaceOwnerKey(ctx, group, resource, ns, okOwner, okKey)
	require.NoError(t, err)
	assert.Equal(t, []string{"p1", "p2"}, ownerKeyNames(items))

	byName := map[string]ResourceKVItem{}
	for _, it := range items {
		byName[it.Name] = it
	}
	for _, name := range []string{"p1", "p2"} {
		it := byName[name]
		assert.Equal(t, okOwner, it.Owner)
		assert.Equal(t, okKey, it.Key)
	}
	assert.JSONEq(t, `{"views_total":1}`, string(byName["p1"].Value), "value is the unwrapped user JSON")
	assert.JSONEq(t, `{"views_total":2}`, string(byName["p2"].Value))
}

func TestResourceKVStore_ScanNamespaceOwnerKey_Empty(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	items, err := store.ScanNamespaceOwnerKey(context.Background(), "playlist.grafana.app", "playlists", "default", okOwner, okKey)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestResourceKVStore_ScanNamespaceOwnerKey_ReflectsOverwriteAndDelete(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()
	p1 := ResourceParent{Group: "g.app", Resource: "things", Namespace: "ns", Name: "a"}
	p2 := ResourceParent{Group: "g.app", Resource: "things", Namespace: "ns", Name: "b"}

	saveJSON(t, store, p1, okOwner, okKey, `{"n":1}`)
	saveJSON(t, store, p1, okOwner, okKey, `{"n":2}`)
	saveJSON(t, store, p2, okOwner, okKey, `{"n":3}`)
	require.NoError(t, store.Delete(ctx, p2, okOwner, okKey))

	items, err := store.ScanNamespaceOwnerKey(ctx, "g.app", "things", "ns", okOwner, okKey)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "a", items[0].Name)
	assert.JSONEq(t, `{"n":2}`, string(items[0].Value))
}

func TestResourceKVStore_ScanNamespaceOwnerKey_ManyResources(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	const n = 1100
	for i := range n {
		p := ResourceParent{Group: "g", Resource: "r", Namespace: "ns", Name: fmt.Sprintf("obj-%04d", i)}
		saveJSON(t, store, p, okOwner, okKey, `{}`)
		saveJSON(t, store, p, okOwner, "daily", `{}`)
	}
	items, err := store.ScanNamespaceOwnerKey(context.Background(), "g", "r", "ns", okOwner, okKey)
	require.NoError(t, err)
	assert.Len(t, items, n)
}

// Property: for any random population of the store, ScanNamespaceOwnerKey
// returns exactly the latest entries whose (group, resource, ns, owner, key)
// match — nothing more, nothing less.
func TestResourceKVStore_ScanNamespaceOwnerKey_Property(t *testing.T) {
	t.Parallel()

	groups := []string{"a.app", "b.app"}
	resources := []string{"things", "things2"}
	namespaces := []string{"ns", "ns2"}
	names := []string{"x", "y", "z", "x2"}
	owners := []string{okOwner, "other.app", okOwner + "x"}
	keys := []string{okKey, "daily", "stats2"}

	for seed := int64(1); seed <= 20; seed++ {
		t.Run(fmt.Sprintf("seed-%d", seed), func(t *testing.T) {
			t.Parallel()
			r := rand.New(rand.NewSource(seed))
			store := newTestStore(t)
			ctx := context.Background()

			type full struct{ g, r, ns, name, owner, key string }
			latest := map[full]string{}
			for i := 0; i < 60; i++ {
				f := full{
					groups[r.Intn(len(groups))], resources[r.Intn(len(resources))], namespaces[r.Intn(len(namespaces))],
					names[r.Intn(len(names))], owners[r.Intn(len(owners))], keys[r.Intn(len(keys))],
				}
				val := fmt.Sprintf(`{"i":%d}`, i)
				saveJSON(t, store, ResourceParent{Group: f.g, Resource: f.r, Namespace: f.ns, Name: f.name}, f.owner, f.key, val)
				latest[f] = val
			}

			tg, tr, tns := groups[0], resources[0], namespaces[0]
			tOwner, tKey := owners[r.Intn(len(owners))], keys[r.Intn(len(keys))]
			want := map[string]string{}
			for f, v := range latest {
				if f.g == tg && f.r == tr && f.ns == tns && f.owner == tOwner && f.key == tKey {
					want[f.name] = v
				}
			}

			items, err := store.ScanNamespaceOwnerKey(ctx, tg, tr, tns, tOwner, tKey)
			require.NoError(t, err)
			got := map[string]string{}
			for _, it := range items {
				assert.Equal(t, tOwner, it.Owner)
				assert.Equal(t, tKey, it.Key)
				_, dup := got[it.Name]
				assert.False(t, dup, "name %q returned twice", it.Name)
				got[it.Name] = string(it.Value)
			}
			require.Len(t, got, len(want))
			for name, v := range want {
				assert.JSONEq(t, v, got[name], name)
			}
		})
	}
}
