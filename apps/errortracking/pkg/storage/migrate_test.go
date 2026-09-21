package storage

import (
	"strings"
	"testing"
)

// migrate re-applies schema.sql on every run, so every statement in it has to tolerate its own
// prior success.
func TestSchemaIsIdempotent(t *testing.T) {
	for _, line := range strings.Split(schemaSQL, "\n") {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "CREATE ") || strings.HasPrefix(trimmed, "CREATE TYPE") {
			continue
		}
		if !strings.Contains(trimmed, "IF NOT EXISTS") {
			t.Errorf("%q must use IF NOT EXISTS", trimmed)
		}
	}
	if strings.Contains(schemaSQL, "CREATE TYPE") && !strings.Contains(schemaSQL, "WHEN duplicate_object THEN NULL") {
		t.Error("CREATE TYPE has no IF NOT EXISTS form and must be guarded against duplicate_object")
	}
}

func TestRuntimeRoleName(t *testing.T) {
	for _, role := range []string{"error_tracking_runtime", "runtime2"} {
		if !roleNamePattern.MatchString(role) {
			t.Errorf("expected %q to be accepted", role)
		}
	}
	for _, role := range []string{"", "postgres; DROP DATABASE postgres", `"runtime"`, "Runtime"} {
		if roleNamePattern.MatchString(role) {
			t.Errorf("expected %q to be rejected", role)
		}
	}
}
