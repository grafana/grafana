package kvregistry

// Unit tests for the kvregistry package.
//
// The package holds a package-level sync.Map that is never reset; there is no
// exported reset function for tests. Tests MUST use unique group/resource names
// per subcase to prevent registrations made in one subtest from affecting others.
// See FINDING below.
//
// FINDING: kvregistry.Register has no reset mechanism for tests.
// Every call to Register is permanent for the lifetime of the process.
// Tests calling Register with shared group/resource names would leak state into
// concurrent or subsequent tests. The workaround used here is unique names.
// If an isolated reset is needed in the future, a package-level ResetForTesting
// func or a factory approach (passing a *sync.Map instead of the global) should
// be added to production code by the engineer — not by the tester.

import (
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestRegister_HasKV_Basic verifies that a registered group/resource is found
// by HasKV and that an unregistered one is not.
func TestRegister_HasKV_Basic(t *testing.T) {
	t.Parallel()
	group := "basic-test.kvregistry.test"
	resource := "widgets"

	assert.False(t, HasKV(group, resource), "before Register: HasKV must return false")
	Register(group, resource)
	assert.True(t, HasKV(group, resource), "after Register: HasKV must return true")
}

// TestRegister_HasKV_Idempotent verifies that registering the same pair twice
// is safe and that HasKV still returns true.
func TestRegister_HasKV_Idempotent(t *testing.T) {
	t.Parallel()
	group := "idempotent-test.kvregistry.test"
	resource := "gadgets"

	Register(group, resource)
	Register(group, resource) // second call must not panic or produce wrong state
	assert.True(t, HasKV(group, resource))
}

// TestHasKV_UnregisteredGroup_ReturnsFalse verifies that HasKV returns false
// for a group that was never registered.
func TestHasKV_UnregisteredGroup_ReturnsFalse(t *testing.T) {
	t.Parallel()
	assert.False(t, HasKV("never-registered.kvregistry.test", "things"))
}

// TestHasKV_PartialMatch_ReturnsFalse verifies that registering "group/widgets"
// does not match "group/gizmos" or "other-group/widgets".
func TestHasKV_PartialMatch_ReturnsFalse(t *testing.T) {
	t.Parallel()
	group := "partial-match-test.kvregistry.test"

	Register(group, "widgets")

	assert.False(t, HasKV(group, "gizmos"),
		"a different resource in the same group must not match")
	assert.False(t, HasKV("other-group.kvregistry.test", "widgets"),
		"the same resource in a different group must not match")
}

// TestHasKV_EmptyGroupOrResource_ReturnsFalse verifies that empty strings are
// handled gracefully: HasKV with an empty component always returns false (unless
// someone explicitly registered empty strings, which no real code does).
func TestHasKV_EmptyGroupOrResource_ReturnsFalse(t *testing.T) {
	t.Parallel()
	assert.False(t, HasKV("", "widgets"))
	assert.False(t, HasKV("empty-test.kvregistry.test", ""))
}

// TestRegister_HasKV_MultipleResources verifies that registering multiple
// resources under the same group is supported.
func TestRegister_HasKV_MultipleResources(t *testing.T) {
	t.Parallel()
	group := "multi-resource-test.kvregistry.test"

	Register(group, "alpha")
	Register(group, "beta")

	assert.True(t, HasKV(group, "alpha"))
	assert.True(t, HasKV(group, "beta"))
	assert.False(t, HasKV(group, "gamma"), "unregistered resource must still return false")
}

// TestRegister_HasKV_Concurrent verifies that concurrent Register and HasKV
// calls do not race or panic. This is important because InjectForManifest
// (called at startup) can be invoked concurrently for different groups, and
// authorizerForAPI reads the map on every request.
func TestRegister_HasKV_Concurrent(t *testing.T) {
	t.Parallel()
	const n = 64
	var wg sync.WaitGroup
	wg.Add(n * 2)

	// Writers: register unique pairs concurrently.
	for i := range n {
		go func(i int) {
			defer wg.Done()
			Register(fmt.Sprintf("concurrent-write-%d.kvregistry.test", i), "things")
		}(i)
	}

	// Readers: read (possibly different) pairs while writers run.
	for i := range n {
		go func(i int) {
			defer wg.Done()
			// HasKV may return true or false depending on whether the paired
			// writer has run yet; the important thing is that it does not panic.
			_ = HasKV(fmt.Sprintf("concurrent-write-%d.kvregistry.test", i), "things")
		}(i)
	}

	wg.Wait()

	// After all goroutines complete every registered pair must be visible.
	for i := range n {
		assert.True(t, HasKV(fmt.Sprintf("concurrent-write-%d.kvregistry.test", i), "things"),
			"concurrent registration %d must be visible after all goroutines finish", i)
	}
}
