package kv

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ScanNamespaceOwnerKey returns an entry
// only when its owner segment equals owner AND its key segment equals key
// exactly. Another owner whose key happens to end in
// "usageinsights.grafana.app/stats" must never be returned.

func TestResourceKVStore_ScanNamespaceOwnerKey_ExactOwnerAndKey(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	const group, resource, ns = "playlist.grafana.app", "playlists", "default"
	p := func(name string) ResourceParent {
		return ResourceParent{Group: group, Resource: resource, Namespace: ns, Name: name}
	}

	saveJSON(t, store, p("legit"), okOwner, okKey, `{"views_total":1}`)
	// Another owner whose key spells the target owner/key.
	saveJSON(t, store, p("spoof-key"), "evil.example.app", okOwner+"/"+okKey, `{"views_total":9999}`)
	// An owner that ends with the target owner.
	saveJSON(t, store, p("spoof-owner-suffix"), "x."+okOwner, okKey, `{"views_total":9999}`)
	saveJSON(t, store, p("spoof-owner-glued"), "evil"+okOwner, okKey, `{"views_total":9999}`)
	// The target owner, but a longer multi-segment key ending in the target.
	saveJSON(t, store, p("spoof-deep-key"), okOwner, "a/"+okOwner+"/"+okKey, `{"views_total":9999}`)
	saveJSON(t, store, p("spoof-sub-key"), okOwner, "x/"+okKey, `{"views_total":9999}`)

	items, err := store.ScanNamespaceOwnerKey(ctx, group, resource, ns, okOwner, okKey)
	require.NoError(t, err)
	assert.Equal(t, []string{"legit"}, ownerKeyNames(items),
		"only the entry whose owner is exactly %q and key exactly %q may be returned", okOwner, okKey)
	for _, it := range items {
		assert.Equal(t, okOwner, it.Owner)
		assert.Equal(t, okKey, it.Key)
	}
}

// Property: for random owners other than the target (valid owner charset)
// and keys whose trailing segments spell "<target owner>/<target key>", no
// such entry is ever returned; the one legit entry always is.
func TestResourceKVStore_ScanNamespaceOwnerKey_NeverReturnsOtherOwners_Property(t *testing.T) {
	t.Parallel()
	const ownerChars = "abcdefghijklmnopqrstuvwxyz0123456789.-"
	const segChars = "abcdefghijklmnopqrstuvwxyz0123456789_.-"
	const segFirst = "abcdefghijklmnopqrstuvwxyz0123456789"

	randStr := func(r *rand.Rand, first, rest string, n int) string {
		b := []byte{first[r.Intn(len(first))]}
		for i := 1; i < n; i++ {
			b = append(b, rest[r.Intn(len(rest))])
		}
		return string(b)
	}

	for seed := int64(1); seed <= 25; seed++ {
		t.Run(fmt.Sprintf("seed=%d", seed), func(t *testing.T) {
			t.Parallel()
			r := rand.New(rand.NewSource(seed))
			store := newTestStore(t)
			ctx := context.Background()
			const group, resource, ns = "playlist.grafana.app", "playlists", "default"
			p := func(name string) ResourceParent {
				return ResourceParent{Group: group, Resource: resource, Namespace: ns, Name: name}
			}

			saveJSON(t, store, p("legit"), okOwner, okKey, `{"views_total":1}`)
			for i := 0; i < 20; i++ {
				owner := randStr(r, ownerChars, ownerChars, 1+r.Intn(20))
				switch r.Intn(3) {
				case 0:
					owner += okOwner // glued suffix
				case 1:
					owner = owner + "." + okOwner // dotted suffix
				}
				if owner == okOwner {
					continue
				}
				prefix := ""
				for j := r.Intn(3); j > 0; j-- {
					prefix += randStr(r, segFirst, segChars, 1+r.Intn(10)) + "/"
				}
				key := prefix + okOwner + "/" + okKey
				saveJSON(t, store, p(fmt.Sprintf("spoof-%d", i)), owner, key, `{"views_total":9999}`)

				// The target owner with a deeper key that ends in the target key.
				deep := randStr(r, segFirst, segChars, 1+r.Intn(10)) + "/" + okKey
				saveJSON(t, store, p(fmt.Sprintf("deep-%d", i)), okOwner, deep, `{"views_total":9999}`)
			}

			items, err := store.ScanNamespaceOwnerKey(ctx, group, resource, ns, okOwner, okKey)
			require.NoError(t, err)
			assert.Equal(t, []string{"legit"}, ownerKeyNames(items))
		})
	}
}
