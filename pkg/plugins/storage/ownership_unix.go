//go:build !windows

package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

// chownFunc is a function type for changing file ownership
type chownFunc func(name string, uid, gid int) error

// ownershipChanger handles changing file ownership
type ownershipChanger struct {
	chown chownFunc
}

// defaultOwnershipChanger uses the real os.Chown function
var defaultOwnershipChanger = &ownershipChanger{chown: os.Chown}

// matchOwnershipToParent ensures child directory and all its contents inherit ownership from parent dir (UID/GID).
func matchOwnershipToParent(child, parent string) error {
	return matchOwnershipToParentWithChanger(child, parent, defaultOwnershipChanger)
}

// matchOwnershipToParentWithChanger is the testable version that accepts a custom ownership changer
func matchOwnershipToParentWithChanger(child, parent string, changer *ownershipChanger) error {
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
		return changer.chown(path, uid, gid)
	})
}
