//go:build !windows

package storage

import (
    "fmt"
    "os"
    "syscall"
)

// matchOwnershipToParent ensures child directory and all its contents inherit ownership from parent dir (UID/GID).
func matchOwnershipToParent(child, parent string) error {
	parentInfo, err := os.Stat(parent)
	if err != nil {
		return err
	}

	sys := parentInfo.Sys()
	stat, ok := sys.(*syscall.Stat_t)
	if !ok {
		// avoid panics on non-Unix or unexpected platforms
		return fmt.Errorf("ownership: unsupported stat type %T", sys)
	}

	uid := int(stat.Uid)
	gid := int(stat.Gid)

	// Recursively apply ownership to all files and directories
	return filepath.WalkDir(child, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		return os.Chown(path, uid, gid)
	})
}
