//go:build !windows

package search

import (
	"os"
	"syscall"
)

// tryAcquireLock attempts to acquire an exclusive lock on the given file path.
// Returns the locked file handle if successful, or an error if the lock cannot be acquired.
// The caller is responsible for closing the file to release the lock.
func tryAcquireLock(path string) (*os.File, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}

	// Try to acquire an exclusive, non-blocking lock
	err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	if err != nil {
		f.Close()
		return nil, err
	}

	return f, nil
}
