package rbac

// Tests for the generic kv fallback in MapperRegistry.Get.
//
// The fallback fires when:
//   - The requested subresource is "kv" or "kv:batch"
//   - kvregistry.HasKV(group, resource) is true
//   - The parent resource entry exists in the mapper's static table
//
// The derived translation maps every verb to the parent's {resource}:read action
// and mirrors the parent's folder support for action sets.
//
// Tests in this file register group/resource pairs with kvregistry.Register at
// init() time. Because the kvregistry sync.Map is never reset, unique groups are
// used per test to prevent cross-test interference.

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/kvregistry"
)

func init() {
	// Register the groups/resources used in these tests so the mapper fallback fires.
	// dashboard.grafana.app/dashboards and playlist.grafana.app/playlists are already
	// registered in production (via InjectForManifest at startup), but unit tests do
	// not start a real server, so we call Register explicitly here.
	kvregistry.Register("dashboard.grafana.app", "dashboards")
	kvregistry.Register("playlist.grafana.app", "playlists")
}

// ─── dashboards/kv: folder-scoped parent ──────────────────────────────────────

// TestMapperRegistry_KV_DashboardsKV_AllVerbsMapToRead verifies that every verb
// on dashboards/kv maps to "dashboards:read" (the parent's read action).
func TestMapperRegistry_KV_DashboardsKV_AllVerbsMapToRead(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "kv")
	require.True(t, ok, "dashboards/kv must resolve via the kv fallback")
	require.NotNil(t, mapping)

	for _, verb := range []string{
		utils.VerbGet, utils.VerbList, utils.VerbWatch,
		utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch,
		utils.VerbDelete, utils.VerbDeleteCollection,
	} {
		action, ok := mapping.Action(verb)
		assert.True(t, ok, "verb %q must have an action", verb)
		assert.Equal(t, "dashboards:read", action,
			"verb %q on dashboards/kv must map to dashboards:read (not create/write/delete)", verb)
	}
}

// TestMapperRegistry_KV_DashboardsKV_HasFolderSupport verifies that the derived
// kv mapping inherits folder support from the parent dashboards mapping.
func TestMapperRegistry_KV_DashboardsKV_HasFolderSupport(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "kv")
	require.True(t, ok)
	assert.True(t, mapping.HasFolderSupport(),
		"dashboards/kv must inherit folder support from the dashboards parent")
}

// TestMapperRegistry_KV_DashboardsKV_FolderActionSets verifies that the
// view/edit/admin folder action sets are mirrored onto the kv mapping so that
// users granted via managed folder roles can access kv.
func TestMapperRegistry_KV_DashboardsKV_FolderActionSets(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "kv")
	require.True(t, ok)

	// For a folder-scoped resource, action sets for every read-tier verb must
	// include folders:view so that a user granted "folders:view" via a managed
	// role can reach the kv subresource.
	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbUpdate} {
		sets := mapping.ActionSets(verb)
		assert.Contains(t, sets, "folders:view",
			"verb %q action sets must include folders:view", verb)
		assert.Contains(t, sets, "dashboards:view",
			"verb %q action sets must include dashboards:view", verb)
	}
}

// TestMapperRegistry_KV_DashboardsBatch_AllVerbsMapToRead verifies the same
// read-only mapping for the dashboards/kv:batch subresource.
func TestMapperRegistry_KV_DashboardsBatch_AllVerbsMapToRead(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "kv:batch")
	require.True(t, ok, "dashboards/kv:batch must resolve via the kv fallback")
	require.NotNil(t, mapping)

	action, ok := mapping.Action(utils.VerbCreate)
	assert.True(t, ok)
	assert.Equal(t, "dashboards:read", action,
		"kv:batch create verb must map to the parent's read action, not dashboards:create")
}

// TestMapperRegistry_KV_DashboardsBatch_HasFolderSupport verifies folder support
// is inherited for kv:batch too.
func TestMapperRegistry_KV_DashboardsBatch_HasFolderSupport(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "kv:batch")
	require.True(t, ok)
	assert.True(t, mapping.HasFolderSupport())
}

// ─── playlists/kv: non-folder-scoped parent ────────────────────────────────────

// TestMapperRegistry_KV_PlaylistsKV_AllVerbsMapToRead verifies that every verb
// on playlists/kv maps to "playlists:read".
func TestMapperRegistry_KV_PlaylistsKV_AllVerbsMapToRead(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("playlist.grafana.app", "playlists", "kv")
	require.True(t, ok, "playlists/kv must resolve via the kv fallback")
	require.NotNil(t, mapping)

	for _, verb := range []string{
		utils.VerbGet, utils.VerbList, utils.VerbWatch,
		utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch,
		utils.VerbDelete, utils.VerbDeleteCollection,
	} {
		action, ok := mapping.Action(verb)
		assert.True(t, ok, "verb %q must have an action", verb)
		assert.Equal(t, "playlists:read", action,
			"verb %q on playlists/kv must map to playlists:read", verb)
	}
}

// TestMapperRegistry_KV_PlaylistsKV_NoFolderSupport verifies that playlists/kv
// does NOT inherit folder support (playlists are not folder-scoped).
func TestMapperRegistry_KV_PlaylistsKV_NoFolderSupport(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("playlist.grafana.app", "playlists", "kv")
	require.True(t, ok)
	assert.False(t, mapping.HasFolderSupport(),
		"playlists/kv must NOT inherit folder support (playlists are not folder-scoped)")
}

// TestMapperRegistry_KV_PlaylistsKV_NoActionSets verifies that playlists/kv
// has no action sets (because the parent has none for view-tier).
func TestMapperRegistry_KV_PlaylistsKV_NoActionSets(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("playlist.grafana.app", "playlists", "kv")
	require.True(t, ok)

	// playlists have no folder action sets, so kv action sets should be empty.
	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbCreate} {
		sets := mapping.ActionSets(verb)
		assert.Empty(t, sets,
			"verb %q on playlists/kv must have no action sets (non-folder-scoped parent)", verb)
	}
}

// ─── unregistered kind: fallback must not fire ─────────────────────────────────

// TestMapperRegistry_KV_UnregisteredKind_NotFound verifies that the kv fallback
// does not fire for a group/resource not in the kvregistry.
func TestMapperRegistry_KV_UnregisteredKind_NotFound(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	// "dashboard.grafana.app/notebooks" IS in the static mapper but NOT in the
	// kvregistry (the C4 manifests only declare kv for dashboards and playlists).
	// So the kv fallback must not fire, and Get should return false.
	//
	// Note: this test pre-registers nothing for "dashboard.grafana.app/notebooks"
	// in the kvregistry; if a future slice adds it, update this test.
	_, ok := reg.Get("dashboard.grafana.app", "notebooks", "kv")
	assert.False(t, ok,
		"notebooks/kv must not be found — notebooks are not declared in the kvregistry")
}

// TestMapperRegistry_KV_UnregisteredGroup_NotFound verifies the fallback for a
// group that is not in the mapper's static table at all.
func TestMapperRegistry_KV_UnregisteredGroup_NotFound(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	_, ok := reg.Get("completely.unknown.grafana.app", "things", "kv")
	assert.False(t, ok, "unknown group must not produce a kv mapping")
}

// ─── existing mappings are unchanged ───────────────────────────────────────────

// TestMapperRegistry_ExistingStaticMappings_Unchanged verifies that the kv
// fallback does not perturb existing static entries.
func TestMapperRegistry_ExistingStaticMappings_Unchanged(t *testing.T) {
	t.Parallel()
	reg := NewMapperRegistry()

	// dashboards (parent, no kv subresource in query) must still work normally.
	dashMapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "")
	require.True(t, ok, "dashboards mapping must still be present")
	action, ok := dashMapping.Action(utils.VerbGet)
	require.True(t, ok)
	assert.Equal(t, "dashboards:read", action, "dashboards:get must still map to dashboards:read")

	createAction, ok := dashMapping.Action(utils.VerbCreate)
	require.True(t, ok)
	assert.Equal(t, "dashboards:create", createAction,
		"dashboards:create must still map to dashboards:create (kv fallback must not change the parent)")

	// playlists parent must still work.
	playMapping, ok := reg.Get("playlist.grafana.app", "playlists", "")
	require.True(t, ok, "playlists mapping must still be present")
	writeAction, ok := playMapping.Action(utils.VerbCreate)
	require.True(t, ok)
	assert.Equal(t, "playlists:write", writeAction)
}
