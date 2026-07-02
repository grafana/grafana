//go:build windows
// +build windows

package storage

import "testing"

// On Windows this is a no-op; must return nil.
func TestMatchOwnershipToParent_NoopOnWindows(t *testing.T) {
	if err := matchOwnershipToParent("somechild", "someparent"); err != nil {
		t.Fatalf("expected nil from noop matchOwnershipToParent on Windows, got: %v", err)
	}
}
