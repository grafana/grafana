// +build !windows

package gou

import (
	"syscall"
	"unsafe"
)

// Determine is this process is running in a Terminal or not?
func IsTerminal() bool {
	ws := &winsize{}
	isTerm := true
	defer func() {
		if r := recover(); r != nil {
			isTerm = false
		}
	}()
	// This blows up on windows
	retCode, _, _ := syscall.Syscall(syscall.SYS_IOCTL,
		uintptr(syscall.Stdin),
		uintptr(_TIOCGWINSZ),
		uintptr(unsafe.Pointer(ws)))

	if int(retCode) == -1 {
		return false
	}
	return isTerm
}
