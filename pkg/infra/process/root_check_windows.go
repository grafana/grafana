//go:build windows
// +build windows

package process

func elevatedPrivilegesCheck() (bool, error) {
	// TODO implement Windows process root check
	return false, nil
}
