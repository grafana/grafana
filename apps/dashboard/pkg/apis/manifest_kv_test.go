package apis

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDashboardManifestData_Validate guards that the generated manifest data is internally
// consistent across all versions and kinds.
func TestDashboardManifestData_Validate(t *testing.T) {
	t.Parallel()
	m := LocalManifest()
	require.NotNil(t, m.ManifestData)
	assert.NoError(t, m.ManifestData.Validate())
}

// TestDashboardManifestData_DashboardKind_HasKV guards that every served version of the Dashboard
// kind declares the kv subresource. If a codegen regeneration silently drops the declaration,
// this test will catch it.
func TestDashboardManifestData_DashboardKind_HasKV(t *testing.T) {
	t.Parallel()
	m := LocalManifest()
	require.NotNil(t, m.ManifestData)

	servedVersionsChecked := 0
	for _, version := range m.ManifestData.Versions {
		if !version.Served {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Kind != "Dashboard" {
				continue
			}
			servedVersionsChecked++
			t.Run(version.Name, func(t *testing.T) {
				t.Parallel()
				assert.True(t, kind.HasKV(),
					"Dashboard kind in served version %s must declare kv", version.Name)
			})
		}
	}
	// Sanity-check: there must be at least one served Dashboard version or the test is vacuously passing.
	require.Greater(t, servedVersionsChecked, 0, "expected at least one served Dashboard version")
}

// TestDashboardManifestData_NonDeclaringKinds_NoKV guards that kinds which have not opted into the
// kv subresource (Snapshot, Variable, Notebook) do not inadvertently acquire it after regeneration.
func TestDashboardManifestData_NonDeclaringKinds_NoKV(t *testing.T) {
	t.Parallel()
	m := LocalManifest()
	require.NotNil(t, m.ManifestData)

	nonDeclaringKinds := map[string]bool{
		"Snapshot": false,
		"Variable": false,
		"Notebook": false,
	}

	for _, version := range m.ManifestData.Versions {
		for _, kind := range version.Kinds {
			if _, isNonDeclaring := nonDeclaringKinds[kind.Kind]; !isNonDeclaring {
				continue
			}
			nonDeclaringKinds[kind.Kind] = true // mark as seen
			t.Run(version.Name+"/"+kind.Kind, func(t *testing.T) {
				t.Parallel()
				assert.False(t, kind.HasKV(),
					"kind %s in version %s must not declare kv", kind.Kind, version.Name)
			})
		}
	}

	// Verify we actually exercised each non-declaring kind so the test is not vacuously true.
	for kindName, seen := range nonDeclaringKinds {
		assert.True(t, seen, "expected to find kind %s in the manifest but it was absent", kindName)
	}
}
