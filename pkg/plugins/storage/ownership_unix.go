//go:build !windows

package storage

import (
    "fmt"
    "os"
    "syscall"
)

// matchOwnershipToParent ensures child inherits ownership from parent dir (UID/GID).
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

    return os.Chown(child, int(stat.Uid), int(stat.Gid))
}
