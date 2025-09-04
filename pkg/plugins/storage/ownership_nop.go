//go:build windows

package storage

// no-op for Windows
func matchOwnershipToParent(_ , _ string) error {
    return nil
}
