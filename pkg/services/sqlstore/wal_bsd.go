//go:build darwin || freebsd

package sqlstore

import (
	"golang.org/x/sys/unix"
)

// Filesystems local to this host, which is what WAL's shared memory needs. statfs
// names them, so network mounts report nfs or smbfs and are left out.
var walFilesystems = map[string]bool{
	"apfs":  true,
	"hfs":   true,
	"ufs":   true,
	"zfs":   true,
	"tmpfs": true,
}

func filesystemSupportsWAL(path string) (string, bool) {
	// Statfs follows symlinks, so this reports the filesystem holding the target.
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return "unknown", false
	}

	name := unix.ByteSliceToString(stat.Fstypename[:])
	return name, walFilesystems[name]
}
