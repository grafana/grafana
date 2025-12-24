//go:build windows

package search

import (
	"os"
	"syscall"
	"unsafe"
)

var (
	modkernel32      = syscall.NewLazyDLL("kernel32.dll")
	procLockFileEx   = modkernel32.NewProc("LockFileEx")
	procUnlockFileEx = modkernel32.NewProc("UnlockFileEx")
)

const (
	lockfileExclusiveLock   = 0x02
	lockfileFailImmediately = 0x01
)

// tryAcquireLock attempts to acquire an exclusive lock on the given file path.
// Returns the locked file handle if successful, or an error if the lock cannot be acquired.
// The caller is responsible for closing the file to release the lock.
func tryAcquireLock(path string) (*os.File, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}

	// Try to acquire an exclusive, non-blocking lock using Windows LockFileEx
	err = lockFileEx(syscall.Handle(f.Fd()))
	if err != nil {
		f.Close()
		return nil, err
	}

	return f, nil
}

func lockFileEx(handle syscall.Handle) error {
	var overlapped syscall.Overlapped
	flags := uint32(lockfileExclusiveLock | lockfileFailImmediately)

	r1, _, err := procLockFileEx.Call(
		uintptr(handle),
		uintptr(flags),
		0, // reserved
		1, // nNumberOfBytesToLockLow
		0, // nNumberOfBytesToLockHigh
		uintptr(unsafe.Pointer(&overlapped)),
	)
	if r1 == 0 {
		return err
	}
	return nil
}
