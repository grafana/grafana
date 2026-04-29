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
