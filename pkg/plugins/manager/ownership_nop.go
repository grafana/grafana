//go:build windows

package manager

// no-op for Windows
func matchOwnershipToParent(_ , _ string) error {
    return nil
}
