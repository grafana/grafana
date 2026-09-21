package storage

import "testing"

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
