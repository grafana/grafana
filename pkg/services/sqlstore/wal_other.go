//go:build !linux && !windows && !darwin && !freebsd

package sqlstore

// Without a way to tell local storage from a network mount, leave WAL off unless the
// operator asks for it.
func filesystemSupportsWAL(_ string) (string, bool) {
	return "unknown", false
}
