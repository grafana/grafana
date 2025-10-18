package testutil

import (
	"embed"
	"strings"
	"testing"
	"time"
)

//go:embed data/*
var dataFS embed.FS

//go:generate mockery --with-expecter --name T

// T provides a clean way to test the utilities of this package.
type T interface {
	Helper()
	Cleanup(func())
	Deadline() (time.Time, bool)
	Errorf(format string, args ...any)
	FailNow()
}

func init() {
	// At the moment of this writing, there is already testing code imported in
	// server runtime code. Please, consider refactoring your code to keep
	// runtime dependencies clean.
	if !testing.Testing() {
		panic("importing testing libraries in runtime code is not allowed")
	}
}

// SkipIntegrationTestInShortMode skips the integration test if it is running in short mode.
// This function fails is the test is not an integration test as defined in Grafana (i.e. test
// starting with TestIntegration prefix).
func SkipIntegrationTestInShortMode(t testing.TB) {
	t.Helper()
	if !strings.HasPrefix(t.Name(), "TestIntegration") {
		t.Fatal("test is not an integration test")
	}
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
}
