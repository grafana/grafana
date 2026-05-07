package kv

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseDataKeyParts_ResourceVersionMetadata(t *testing.T) {
	t.Parallel()

	t.Run("cluster-scoped valid three-part rvMeta", func(t *testing.T) {
		t.Parallel()
		parts := strings.Split("g/res/n/42~updated~fld", "/")
		dk, rvParts, err := ParseDataKeyParts(parts)
		require.NoError(t, err)
		require.Equal(t, "g", dk.Group)
		require.Equal(t, "res", dk.Resource)
		require.Equal(t, "n", dk.Name)
		require.Equal(t, int64(42), dk.ResourceVersion)
		require.Equal(t, DataActionUpdated, dk.Action)
		require.Equal(t, "fld", dk.Folder)
		require.Equal(t, []string{"42", "updated", "fld"}, rvParts)
	})

	t.Run("namespaced valid three-part rvMeta", func(t *testing.T) {
		t.Parallel()
		parts := strings.Split("g/res/ns/n/1~created~", "/")
		dk, rvParts, err := ParseDataKeyParts(parts)
		require.NoError(t, err)
		require.Equal(t, "ns", dk.Namespace)
		require.Equal(t, "n", dk.Name)
		require.Equal(t, int64(1), dk.ResourceVersion)
		require.Equal(t, DataActionCreated, dk.Action)
		require.Equal(t, "", dk.Folder)
		require.Equal(t, []string{"1", "created", ""}, rvParts)
	})

	t.Run("rvMeta single segment returns clear error", func(t *testing.T) {
		t.Parallel()
		// Previously this could panic indexing rvParts[1].
		parts := strings.Split("g/res/n/99", "/")
		_, _, err := ParseDataKeyParts(parts)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid resource version metadata")
		require.Contains(t, err.Error(), "expected at least 3 parts, got 1")
	})

	t.Run("rvMeta two segments returns clear error", func(t *testing.T) {
		t.Parallel()
		parts := strings.Split("g/res/n/1~created", "/")
		_, _, err := ParseDataKeyParts(parts)
		require.Error(t, err)
		require.Contains(t, err.Error(), "expected at least 3 parts, got 2")
	})

	t.Run("rvMeta four tilde segments parses base fields and preserves full rvParts", func(t *testing.T) {
		t.Parallel()
		// Fourth segment is consumed by ParseKeyWithGUID as GUID, not as folder.
		parts := strings.Split("g/res/n/1~created~f~guid-xyz", "/")
		dk, rvParts, err := ParseDataKeyParts(parts)
		require.NoError(t, err)
		require.Equal(t, int64(1), dk.ResourceVersion)
		require.Equal(t, DataActionCreated, dk.Action)
		require.Equal(t, "f", dk.Folder)
		require.Equal(t, []string{"1", "created", "f", "guid-xyz"}, rvParts)
	})
}

// Names of grafana resources are allowed to contain ':' (e.g. user-storage names
// like "grafana-splash-screen:<user-uid>"), but the KV layer's validKeyRegex
// rejects ':'. DataKey.String must encode disallowed characters so the on-disk
// key passes IsValidKey, and ParseDataKeyParts must decode them back.
//
// Why: the dev grafana-kvtest cell crash-looped because a user-storage object
// named "grafana-splash-screen:afgzow84sv3lsf" produced a KV key containing
// ':', which the unified-storage KV server rejected on every iteration during
// resource server init.
func TestDataKey_KvtestSplashScreenReproduction(t *testing.T) {
	t.Parallel()

	dk := DataKey{
		Group:           "userstorage.grafana.app",
		Resource:        "user-storage",
		Namespace:       "default",
		Name:            "grafana-splash-screen:afgzow84sv3lsf",
		ResourceVersion: 2052318477101322240,
		Action:          DataActionCreated,
	}

	encoded := dk.String()
	require.NotContains(t, encoded, ":",
		"DataKey.String must not emit ':' in the on-disk key, got %q", encoded)
	require.True(t, IsValidKey(encoded),
		"DataKey.String must produce a key that passes IsValidKey, got %q", encoded)

	parts := strings.Split(encoded, "/")
	parsed, _, err := ParseDataKeyParts(parts)
	require.NoError(t, err)
	require.Equal(t, dk.Name, parsed.Name, "Name must round-trip through encode/decode")
	require.Equal(t, dk.Group, parsed.Group)
	require.Equal(t, dk.Resource, parsed.Resource)
	require.Equal(t, dk.Namespace, parsed.Namespace)
	require.Equal(t, dk.ResourceVersion, parsed.ResourceVersion)
	require.Equal(t, dk.Action, parsed.Action)
}

func TestEncodeDecodeKeyName(t *testing.T) {
	t.Parallel()

	t.Run("safe characters pass through unchanged", func(t *testing.T) {
		t.Parallel()
		for _, name := range []string{"simple", "a-b-c", "a.b.c", "a_b_c", "abc123", "", "ABC"} {
			require.Equal(t, name, EncodeKeyName(name))
			decoded, err := DecodeKeyName(name)
			require.NoError(t, err)
			require.Equal(t, name, decoded)
		}
	})

	t.Run("colon is escaped to ~3a", func(t *testing.T) {
		t.Parallel()
		require.Equal(t, "a~3ab", EncodeKeyName("a:b"))
		require.Equal(t, "grafana-splash-screen~3aafgzow84sv3lsf",
			EncodeKeyName("grafana-splash-screen:afgzow84sv3lsf"))
	})

	t.Run("tilde itself is escaped so escapes are unambiguous", func(t *testing.T) {
		t.Parallel()
		// '~' is the escape marker so a literal '~' must be encoded too,
		// otherwise decode could be ambiguous.
		require.Equal(t, "a~7eb", EncodeKeyName("a~b"))
	})

	t.Run("round-trip for representative names", func(t *testing.T) {
		t.Parallel()
		for _, name := range []string{
			"grafana-splash-screen:afgzow84sv3lsf",
			"service:user-uid",
			"a:b:c:d",
			"with.dots-and-dashes",
			"no_underscores_either",
		} {
			encoded := EncodeKeyName(name)
			decoded, err := DecodeKeyName(encoded)
			require.NoError(t, err)
			require.Equal(t, name, decoded)
			require.True(t, IsValidKey(encoded),
				"encoded form %q must pass IsValidKey", encoded)
		}
	})

	t.Run("decode rejects truncated escape", func(t *testing.T) {
		t.Parallel()
		_, err := DecodeKeyName("foo~3")
		require.Error(t, err)
		_, err = DecodeKeyName("foo~")
		require.Error(t, err)
	})

	t.Run("decode rejects non-hex escape", func(t *testing.T) {
		t.Parallel()
		_, err := DecodeKeyName("foo~zz")
		require.Error(t, err)
	})
}

func TestParseKeyWithGUID(t *testing.T) {
	t.Parallel()

	t.Run("round trip StringWithGUID", func(t *testing.T) {
		t.Parallel()
		// Namespaced key: group/resource/namespace/name/rv~action~folder~guid (5 slash segments).
		key := "apps/deployments/default/nginx/5~updated~fld~guid-abc"
		dk, err := ParseKeyWithGUID(key)
		require.NoError(t, err)
		require.Equal(t, "guid-abc", dk.GUID)
		require.Equal(t, int64(5), dk.ResourceVersion)
		require.Equal(t, DataActionUpdated, dk.Action)
		require.Equal(t, "fld", dk.Folder)
		require.Equal(t, key, dk.StringWithGUID())
	})

	t.Run("rejects key with only three tilde parts in rvMeta", func(t *testing.T) {
		t.Parallel()
		// ParseDataKeyParts succeeds but GUID requires fourth segment.
		_, err := ParseKeyWithGUID("g/res/n/1~created~f")
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid key metadata")
		require.Contains(t, err.Error(), "expected 4 tilde-separated parts, got 3")
	})

	t.Run("invalid rvMeta surfaces from ParseDataKeyParts", func(t *testing.T) {
		t.Parallel()
		_, err := ParseKeyWithGUID("g/res/n/badrv")
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid resource version metadata")
	})
}
