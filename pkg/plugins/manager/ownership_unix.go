//go:build !windows

package manager

import (
    "os"
    "syscall"
)

// matchOwnershipToParent ensures child inherits ownership from parent dir
func matchOwnershipToParent(child, parent string) error {
    parentInfo, err := os.Stat(parent)
    if err != nil {
        return err
    }
    stat := parentInfo.Sys().(*syscall.Stat_t)
    return os.Chown(child, int(stat.Uid), int(stat.Gid))
}
