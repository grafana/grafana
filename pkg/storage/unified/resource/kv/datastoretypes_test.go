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

	t.Run("userstorage format with colon", func(t *testing.T) {
		t.Parallel()
		// User-storage names follow the "<service>:<userUID>" convention
		// enforced by pkg/registry/apis/userstorage/strategy.go, so the Name
		// segment of a KV key for these resources contains ':'. The KV regex
		// must accept that, otherwise iterator-side validation rejects every
		// freshly-written user-storage key with "received invalid key from
		// server" and the resource server cannot init.
		parts := strings.Split("userstorage.grafana.app/user-storage/default/grafana-splash-screen:myuser1234abcd/2052318477101322240~created~", "/")
		dk, rvParts, err := ParseDataKeyParts(parts)
		require.NoError(t, err)
		require.Equal(t, "userstorage.grafana.app", dk.Group)
		require.Equal(t, "user-storage", dk.Resource)
		require.Equal(t, "default", dk.Namespace)
		require.Equal(t, "grafana-splash-screen:myuser1234abcd", dk.Name)
		require.Equal(t, int64(2052318477101322240), dk.ResourceVersion)
		require.Equal(t, DataActionCreated, dk.Action)
		require.Equal(t, "", dk.Folder)
		require.Equal(t, []string{"2052318477101322240", "created", ""}, rvParts)
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
