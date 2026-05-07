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

// Resource Names that pass the Grafana name validator (grafanaNameFmt) include
// ':' — the user-storage strategy uses the "<service>:<userUID>" convention,
// so user-storage names always contain ':'. The KV layer's validKeyRegex must
// accept that, otherwise iterator-side validation (in the enterprise client
// wrapper) rejects every freshly-written user-storage key with "received
// invalid key from server" and the resource server cannot init.
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

	key := dk.String()
	require.Contains(t, key, ":", "':' must survive verbatim in the on-disk key")
	require.True(t, IsValidKey(key),
		"on-disk key %q must pass IsValidKey so iterator validation does not reject it", key)

	parts := strings.Split(key, "/")
	parsed, _, err := ParseDataKeyParts(parts)
	require.NoError(t, err)
	require.Equal(t, dk.Name, parsed.Name)
	require.Equal(t, dk.Group, parsed.Group)
	require.Equal(t, dk.Resource, parsed.Resource)
	require.Equal(t, dk.Namespace, parsed.Namespace)
	require.Equal(t, dk.ResourceVersion, parsed.ResourceVersion)
	require.Equal(t, dk.Action, parsed.Action)
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
