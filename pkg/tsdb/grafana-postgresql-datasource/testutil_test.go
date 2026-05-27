package postgres

import (
	"strings"
	"testing"
)

// skipIntegrationTestInShortMode skips the integration test if running in short mode.
// Local copy to avoid importing pkg/util/testutil.
func skipIntegrationTestInShortMode(t testing.TB) {
	t.Helper()
	if !strings.HasPrefix(t.Name(), "TestIntegration") {
		t.Fatal("test is not an integration test")
	}
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
}
