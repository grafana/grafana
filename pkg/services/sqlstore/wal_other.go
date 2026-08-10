//go:build !linux && !windows

package sqlstore

// Assume local storage: the remaining platforms are almost always developer machines
// with the database on a local disk.
func filesystemSupportsWAL(_ string) (string, bool) {
	return "unknown", true
}
