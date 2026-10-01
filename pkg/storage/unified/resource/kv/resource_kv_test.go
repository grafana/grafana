package kv

// Tests for ResourceKVStore — the name-keyed wrapper that projects every call
// through the key layout {group}/{resource}/{ns}/{name}/{owner}/{key}.
//
// All tests use the in-memory BadgerKV so they run without external dependencies.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

func newTestStore(t *testing.T) *ResourceKVStore {
	t.Helper()
	return NewResourceKVStore(setupTestKV(t))
}

func defaultParent() ResourceParent {
	return ResourceParent{
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Namespace: "stacks-123",
		Name:      "abc-dash",
	}
}

// saveJSON is a test helper that calls Save with a short JSON payload.
func saveJSON(t *testing.T, s *ResourceKVStore, p ResourceParent, owner, key, json string) {
	t.Helper()
	require.NoError(t, s.Save(context.Background(), p, owner, key, []byte(json), "test-id"))
}

// ─── Section constant ─────────────────────────────────────────────────────────

func TestResourceKVStore_SectionConstant(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "resource/kv", ResourceKVSection)
}

// ─── Key layout ───────────────────────────────────────────────────────────────

func TestResourceKVStore_KeyPrefix_Format(t *testing.T) {
	t.Parallel()
	got := kvPrefix(defaultParent())
	const want = "dashboard.grafana.app/dashboards/stacks-123/abc-dash/"
	assert.Equal(t, want, got)
}

func TestResourceKVStore_KeyStoredUnderExpectedPath(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()
	parent := defaultParent()

	const owner = "usageinsights.grafana.app"
	const key = "stats"
	require.NoError(t, store.Save(ctx, parent, owner, key, []byte(`{"v":1}`), "id"))

	wantRaw := kvPrefix(parent) + owner + "/" + key
	var found bool
	for k, err := range store.kv.Keys(ctx, ResourceKVSection, ListOptions{}) {
		require.NoError(t, err)
		if k == wantRaw {
			found = true
			break
		}
	}
	assert.True(t, found, "raw KV key %q must exist in section %s", wantRaw, ResourceKVSection)
}

// ─── DeleteAllForName clears the slate for a re-create ───────────────────────

// TestResourceKVStore_DeleteAllForName_StartsClean verifies that after
// DeleteAllForName is called for a name, writing under that name starts fresh.
// This is the "clear on create" invariant: a re-created or restored object
// never sees data from a previous incarnation.
func TestResourceKVStore_DeleteAllForName_StartsClean(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	p := ResourceParent{
		Group: "dashboard.grafana.app", Resource: "dashboards",
		Namespace: "stacks-123", Name: "reused",
	}

	// Write data for the first incarnation.
	require.NoError(t, store.Save(ctx, p, "usageinsights.grafana.app", "stats",
		[]byte(`{"views_total":999}`), "svc"))

	// Simulate delete: clear the name prefix.
	require.NoError(t, store.DeleteAllForName(ctx, p.Group, p.Resource, p.Namespace, p.Name))

	// After clear, the name must see no data (simulate the next create).
	_, _, _, err := store.Get(ctx, p, "usageinsights.grafana.app", "stats") //nolint:dogsled
	require.ErrorIs(t, err, ErrNotFound, "after DeleteAllForName the object must be empty")

	keys, err := store.Keys(ctx, p, ListOptions{})
	require.NoError(t, err)
	assert.Empty(t, keys, "Keys must be empty after DeleteAllForName")

	// Re-save must work (new incarnation starts clean).
	require.NoError(t, store.Save(ctx, p, "usageinsights.grafana.app", "stats",
		[]byte(`{"views_total":1}`), "svc"))
	got, _, _, err := store.Get(ctx, p, "usageinsights.grafana.app", "stats") //nolint:dogsled
	require.NoError(t, err)
	assert.JSONEq(t, `{"views_total":1}`, string(got), "re-save after clear must succeed and be readable")
}

// ─── Save / Get / Delete round-trip ──────────────────────────────────────────

func TestResourceKVStore_GetMissing_ErrNotFound(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	_, _, _, err := store.Get(context.Background(), defaultParent(), "usageinsights.grafana.app", "missing") //nolint:dogsled
	require.ErrorIs(t, err, ErrNotFound)
}

func TestResourceKVStore_SaveGetDelete(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	const owner = "usageinsights.grafana.app"
	const key = "stats"

	// Save then Get.
	require.NoError(t, store.Save(ctx, parent, owner, key, []byte(`{"x":1}`), "id"))
	got, _, _, err := store.Get(ctx, parent, owner, key) //nolint:dogsled
	require.NoError(t, err)
	assert.JSONEq(t, `{"x":1}`, string(got))

	// Save again (last-write-wins).
	require.NoError(t, store.Save(ctx, parent, owner, key, []byte(`{"x":2}`), "id"))
	got, _, _, err = store.Get(ctx, parent, owner, key) //nolint:dogsled
	require.NoError(t, err)
	assert.JSONEq(t, `{"x":2}`, string(got))

	// Delete then Get → ErrNotFound.
	require.NoError(t, store.Delete(ctx, parent, owner, key))
	_, _, _, err = store.Get(ctx, parent, owner, key) //nolint:dogsled
	require.ErrorIs(t, err, ErrNotFound)
}

func TestResourceKVStore_Delete_Idempotent(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()
	parent := defaultParent()
	// Delete a key that was never created — must not error.
	require.NoError(t, store.Delete(ctx, parent, "usageinsights.grafana.app", "ghost"))
	// Second delete must also succeed.
	require.NoError(t, store.Delete(ctx, parent, "usageinsights.grafana.app", "ghost"))
}

// ─── Envelope ─────────────────────────────────────────────────────────────────

// TestResourceKVStore_Envelope_RoundTrip verifies that:
//   - the stored raw bytes contain a valid envelope {v, at, by}
//   - Get returns the original JSON bytes, the unix timestamp, and the identity
func TestResourceKVStore_Envelope_RoundTrip(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	const owner = "usageinsights.grafana.app"
	const key = "stats"
	userJSON := []byte(`{"views_total":100}`)

	require.NoError(t, store.Save(ctx, parent, owner, key, userJSON, "svc:usageinsights"))

	// Inspect raw stored bytes: must be an envelope.
	rawKey := kvPrefix(parent) + owner + "/" + key
	rc, err := store.kv.Get(ctx, ResourceKVSection, rawKey)
	require.NoError(t, err)

	var raw []byte
	raw, err = readAll(t, rc)
	require.NoError(t, err)

	var env struct {
		V  json.RawMessage `json:"v"`
		At int64           `json:"at"`
		By string          `json:"by"`
	}
	require.NoError(t, json.Unmarshal(raw, &env), "stored value must be a valid envelope")
	assert.JSONEq(t, string(userJSON), string(env.V))
	assert.Greater(t, env.At, int64(0))
	assert.Equal(t, "svc:usageinsights", env.By)

	// Get must unwrap and return original bytes + metadata.
	got, updatedAt, updatedBy, err := store.Get(ctx, parent, owner, key)
	require.NoError(t, err)
	assert.JSONEq(t, string(userJSON), string(got))
	assert.Greater(t, updatedAt, int64(0))
	assert.Equal(t, "svc:usageinsights", updatedBy)
}

// readAll drains an io.ReadCloser. Defined here since kv_test.go does not export it.
func readAll(t *testing.T, rc io.ReadCloser) ([]byte, error) {
	t.Helper()
	defer func() { _ = rc.Close() }()
	return io.ReadAll(rc)
}

// ─── Validation ───────────────────────────────────────────────────────────────

func TestResourceKVStore_Validation_OwnerKey(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	cases := []struct {
		name  string
		owner string
		key   string
		valid bool
	}{
		// Valid
		{"plain owner and key", "usageinsights.grafana.app", "stats", true},
		{"underscore in key", "rendering.grafana.app", "render_errors", true},
		{"dots and hyphens in owner", "plugin-id.v1", "my-key.v2", true},
		{"key starting with digit", "usageinsights.grafana.app", "0daily", true},
		{"multi-segment key two parts", "usageinsights.grafana.app", "section/sub-key", true},
		{"multi-segment key three parts", "usageinsights.grafana.app", "a/b/c", true},
		{"segment exactly 128 chars", "usageinsights.grafana.app", strings.Repeat("a", 128), true},

		// Invalid — ErrInvalidKey
		{"empty owner", "", "stats", false},
		{"empty key", "usageinsights.grafana.app", "", false},
		{"colon in key", "usageinsights.grafana.app", "bad:key", false},
		{"slash in owner", "bad/slash.app", "stats", false},
		{"uppercase in owner", "UPPER.grafana.app", "stats", false},
		{"uppercase in key", "usageinsights.grafana.app", "UPPERCASE", false},
		{"segment longer than 128 chars", "usageinsights.grafana.app", strings.Repeat("a", 129), false},
		{"key segment starts with underscore", "usageinsights.grafana.app", "_reserved", false},
		{"key segment starts with dot", "usageinsights.grafana.app", ".hidden", false},
		{"bad segment in multi-segment key", "usageinsights.grafana.app", "ok/_bad-segment", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := store.Save(ctx, parent, tc.owner, tc.key, []byte(`{}`), "id")
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.ErrorIs(t, err, ErrInvalidKey,
					"expected ErrInvalidKey for owner=%q key=%q, got %v", tc.owner, tc.key, err)
			}
		})
	}
}

// ─── Value size cap ───────────────────────────────────────────────────────────

func TestResourceKVStore_ValueSize(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	// Exactly MaxKVValueBytes must succeed.
	exactMax := make([]byte, MaxKVValueBytes)
	exactMax[0] = '"'
	for i := 1; i < MaxKVValueBytes-1; i++ {
		exactMax[i] = 'x'
	}
	exactMax[MaxKVValueBytes-1] = '"'
	require.NoError(t, store.Save(ctx, parent, "usageinsights.grafana.app", "exact-max", exactMax, "id"),
		"Save at exactly MaxKVValueBytes must succeed")

	// One byte over must fail with ErrValueTooLarge.
	oversized := make([]byte, MaxKVValueBytes+1)
	for i := range oversized {
		oversized[i] = 'x'
	}

	err := store.Save(ctx, parent, "usageinsights.grafana.app", "oversized", oversized, "id")
	require.Error(t, err)
	require.ErrorIs(t, err, ErrValueTooLarge, "Save with oversized value must return ErrValueTooLarge")

	// Batch with an oversized value must also fail with ErrValueTooLarge.
	err = store.Batch(ctx, parent, []ResourceKVBatchOp{
		{Mode: BatchOpPut, Owner: "usageinsights.grafana.app", Key: "batch-over", Value: oversized},
	})
	require.Error(t, err)
	require.ErrorIs(t, err, ErrValueTooLarge, "Batch with oversized value must return ErrValueTooLarge")
}

// ─── Keys / KeysByOwner ───────────────────────────────────────────────────────

func TestResourceKVStore_Keys_All(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	saveJSON(t, store, parent, "usageinsights.grafana.app", "stats", `{}`)
	saveJSON(t, store, parent, "usageinsights.grafana.app", "daily", `{}`)
	saveJSON(t, store, parent, "rendering.grafana.app", "stats", `{}`)

	all, err := store.Keys(ctx, parent, ListOptions{})
	require.NoError(t, err)
	assert.Len(t, all, 3)

	// Returned keys must be in owner/key format (parent prefix stripped).
	for _, k := range all {
		assert.True(t, strings.Contains(k, "/"), "key %q must contain a slash separator", k)
	}
}

func TestResourceKVStore_KeysByOwner_ServerSideFilter(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	saveJSON(t, store, parent, "usageinsights.grafana.app", "stats", `{}`)
	saveJSON(t, store, parent, "usageinsights.grafana.app", "daily", `{}`)
	saveJSON(t, store, parent, "rendering.grafana.app", "stats", `{}`)

	// KeysByOwner issues a narrowed scan — returned strings are bare key names only.
	uiKeys, err := store.KeysByOwner(ctx, parent, "usageinsights.grafana.app")
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"stats", "daily"}, uiKeys,
		"KeysByOwner must return bare key names for the requested owner")

	renderKeys, err := store.KeysByOwner(ctx, parent, "rendering.grafana.app")
	require.NoError(t, err)
	assert.Equal(t, []string{"stats"}, renderKeys,
		"KeysByOwner must not return keys from a different owner")
}

// ─── Batch ─────────────────────────────────────────────────────────────────────

func TestResourceKVStore_Batch_Modes(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	const owner = "usageinsights.grafana.app"

	t.Run("put creates and overwrites", func(t *testing.T) {
		t.Parallel()
		require.NoError(t, store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpPut, Owner: owner, Key: "put-key", Value: []byte(`{"v":1}`)},
		}))
		got, _, _, err := store.Get(ctx, parent, owner, "put-key")
		require.NoError(t, err)
		assert.JSONEq(t, `{"v":1}`, string(got))

		// Overwrite via put.
		require.NoError(t, store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpPut, Owner: owner, Key: "put-key", Value: []byte(`{"v":2}`)},
		}))
		got, _, _, err = store.Get(ctx, parent, owner, "put-key")
		require.NoError(t, err)
		assert.JSONEq(t, `{"v":2}`, string(got))
	})

	t.Run("create fails on existing key with ErrKeyAlreadyExists", func(t *testing.T) {
		t.Parallel()
		saveJSON(t, store, parent, owner, "create-existing", `{}`)

		err := store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpCreate, Owner: owner, Key: "create-existing", Value: []byte(`{"new":true}`)},
		})
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrKeyAlreadyExists),
			"create on existing key must wrap ErrKeyAlreadyExists, got: %v", err)
	})

	t.Run("create succeeds for new key", func(t *testing.T) {
		t.Parallel()
		require.NoError(t, store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpCreate, Owner: owner, Key: "create-new", Value: []byte(`{"created":true}`)},
		}))
		got, _, _, err := store.Get(ctx, parent, owner, "create-new")
		require.NoError(t, err)
		assert.JSONEq(t, `{"created":true}`, string(got))
	})

	t.Run("update fails on absent key with ErrNotFound", func(t *testing.T) {
		t.Parallel()
		err := store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpUpdate, Owner: owner, Key: "update-missing", Value: []byte(`{}`)},
		})
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrNotFound),
			"update on absent key must wrap ErrNotFound, got: %v", err)
	})

	t.Run("update succeeds on existing key", func(t *testing.T) {
		t.Parallel()
		saveJSON(t, store, parent, owner, "update-existing", `{"v":1}`)
		require.NoError(t, store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpUpdate, Owner: owner, Key: "update-existing", Value: []byte(`{"v":2}`)},
		}))
		got, _, _, err := store.Get(ctx, parent, owner, "update-existing")
		require.NoError(t, err)
		assert.JSONEq(t, `{"v":2}`, string(got))
	})

	t.Run("delete is idempotent", func(t *testing.T) {
		t.Parallel()
		require.NoError(t, store.Batch(ctx, parent, []ResourceKVBatchOp{
			{Mode: BatchOpDelete, Owner: owner, Key: "ghost"},
		}))
	})
}

func TestResourceKVStore_Batch_Atomicity(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	const owner = "usageinsights.grafana.app"
	saveJSON(t, store, parent, owner, "atomic-existing", `{"original":true}`)

	// A batch with a failing op mid-way must leave no partial writes.
	err := store.Batch(ctx, parent, []ResourceKVBatchOp{
		{Mode: BatchOpPut, Owner: owner, Key: "atomic-new", Value: []byte(`{"should":"rollback"}`)},
		{Mode: BatchOpCreate, Owner: owner, Key: "atomic-existing", Value: []byte(`{"fails":"duplicate"}`)},
	})
	require.Error(t, err)

	// New key must not have been created.
	_, _, _, getErr := store.Get(ctx, parent, owner, "atomic-new") //nolint:dogsled
	require.ErrorIs(t, getErr, ErrNotFound, "partial write must be rolled back")

	// Existing key must retain its original value.
	got, _, _, getErr := store.Get(ctx, parent, owner, "atomic-existing")
	require.NoError(t, getErr)
	assert.JSONEq(t, `{"original":true}`, string(got))
}

func TestResourceKVStore_Batch_MaxOps_Rejected(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	parent := defaultParent()
	ctx := context.Background()

	ops := make([]ResourceKVBatchOp, MaxBatchOps+1)
	for i := range ops {
		ops[i] = ResourceKVBatchOp{
			Mode:  BatchOpPut,
			Owner: "usageinsights.grafana.app",
			Key:   "key",
			Value: []byte(`{}`),
		}
	}
	require.Error(t, store.Batch(ctx, parent, ops))
}

// ─── DeleteAllForName ─────────────────────────────────────────────────────────

func TestResourceKVStore_DeleteAllForName(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	const (
		group    = "dashboard.grafana.app"
		resource = "dashboards"
		ns       = "stacks-123"
		name     = "abc-dash"
	)

	target := ResourceParent{Group: group, Resource: resource, Namespace: ns, Name: name}

	// Another name in the same namespace — must be untouched.
	other := ResourceParent{Group: group, Resource: resource, Namespace: ns, Name: "other-dash"}

	// Another namespace — must be untouched.
	otherNS := ResourceParent{Group: group, Resource: resource, Namespace: "other-ns", Name: name}

	saveJSON(t, store, target, "usageinsights.grafana.app", "stats", `{"a":1}`)
	saveJSON(t, store, target, "usageinsights.grafana.app", "daily", `{"a":2}`)
	saveJSON(t, store, other, "usageinsights.grafana.app", "stats", `{"other":true}`)
	saveJSON(t, store, otherNS, "usageinsights.grafana.app", "stats", `{"ns":true}`)

	require.NoError(t, store.DeleteAllForName(ctx, group, resource, ns, name))

	// All keys for the target name must be gone.
	_, _, _, err := store.Get(ctx, target, "usageinsights.grafana.app", "stats") //nolint:dogsled
	require.ErrorIs(t, err, ErrNotFound, "stats key must be removed")

	_, _, _, err = store.Get(ctx, target, "usageinsights.grafana.app", "daily") //nolint:dogsled
	require.ErrorIs(t, err, ErrNotFound, "daily key must be removed")

	// Other name in the same namespace must be untouched.
	got, _, _, err := store.Get(ctx, other, "usageinsights.grafana.app", "stats")
	require.NoError(t, err)
	assert.JSONEq(t, `{"other":true}`, string(got), "other name in same namespace must be untouched")

	// Same name in another namespace must be untouched.
	got, _, _, err = store.Get(ctx, otherNS, "usageinsights.grafana.app", "stats")
	require.NoError(t, err)
	assert.JSONEq(t, `{"ns":true}`, string(got), "same name in another namespace must be untouched")
}

// ─── ScanNamespace ────────────────────────────────────────────────────────────

func TestResourceKVStore_ScanNamespace(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	const (
		group    = "dashboard.grafana.app"
		resource = "dashboards"
		ns       = "stacks-scan"
	)

	parents := []ResourceParent{
		{Group: group, Resource: resource, Namespace: ns, Name: "d1"},
		{Group: group, Resource: resource, Namespace: ns, Name: "d2"},
	}
	for _, p := range parents {
		saveJSON(t, store, p, "usageinsights.grafana.app", "stats", `{"views_total":1}`)
	}

	// Write into a different namespace — must not appear in the scan.
	otherNS := ResourceParent{Group: group, Resource: resource, Namespace: "other-ns", Name: "d3"}
	saveJSON(t, store, otherNS, "usageinsights.grafana.app", "stats", `{"views_total":99}`)

	results, err := store.ScanNamespace(ctx, group, resource, ns)
	require.NoError(t, err)
	assert.Len(t, results, 2, "ScanNamespace must return only entries in the given namespace")

	byName := make(map[string]ResourceKVItem, len(results))
	for _, r := range results {
		byName[r.Name] = r
	}

	r1, ok := byName["d1"]
	require.True(t, ok, "result must include d1")
	assert.Equal(t, "usageinsights.grafana.app", r1.Owner)
	assert.Equal(t, "stats", r1.Key)
	assert.JSONEq(t, `{"views_total":1}`, string(r1.Value), "ScanNamespace must return unwrapped user JSON")

	r2, ok := byName["d2"]
	require.True(t, ok, "result must include d2")
	assert.Equal(t, "d2", r2.Name)
}

func TestResourceKVStore_PrefixBoundaries(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	t.Run("DeleteAllForName does not touch a name that extends it", func(t *testing.T) {
		t.Parallel()
		store := newTestStore(t)
		dash := ResourceParent{Group: "g", Resource: "r", Namespace: "ns", Name: "dash"}
		dash2 := ResourceParent{Group: "g", Resource: "r", Namespace: "ns", Name: "dash2"}
		saveJSON(t, store, dash, "owner", "k", `1`)
		saveJSON(t, store, dash2, "owner", "k", `2`)

		require.NoError(t, store.DeleteAllForName(ctx, "g", "r", "ns", "dash"))

		got, _, _, err := store.Get(ctx, dash2, "owner", "k")
		require.NoError(t, err)
		assert.JSONEq(t, `2`, string(got))
	})

	t.Run("KeysByOwner does not return keys of an owner that extends it", func(t *testing.T) {
		t.Parallel()
		store := newTestStore(t)
		p := defaultParent()
		saveJSON(t, store, p, "a", "k1", `1`)
		saveJSON(t, store, p, "a.b", "k2", `2`)

		keys, err := store.KeysByOwner(ctx, p, "a")
		require.NoError(t, err)
		assert.Equal(t, []string{"k1"}, keys)
	})
}

func TestResourceKVStore_Delete_ValidatesOwnerKey(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	require.ErrorIs(t, store.Delete(ctx, defaultParent(), "", "stats"), ErrInvalidKey)
	err := store.Batch(ctx, defaultParent(), []ResourceKVBatchOp{{Mode: BatchOpDelete, Owner: "Bad", Key: "stats"}})
	require.ErrorIs(t, err, ErrInvalidKey)
}

func TestResourceKVStore_ScanNamespace_SpansBatchGetChunks(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	ctx := context.Background()

	const n = 1100
	for i := range n {
		p := ResourceParent{Group: "g", Resource: "r", Namespace: "ns", Name: fmt.Sprintf("obj-%04d", i)}
		saveJSON(t, store, p, "owner", "stats", `{}`)
	}

	items, err := store.ScanNamespace(ctx, "g", "r", "ns")
	require.NoError(t, err)
	assert.Len(t, items, n)
}
