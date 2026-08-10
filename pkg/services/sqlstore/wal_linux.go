package sqlstore

import (
	"fmt"

	"golang.org/x/sys/unix"
)

// x/sys has no constant for ZFS.
const zfsSuperMagic = 0x2fc12fc1

// Filesystems local to this host, which is what WAL's shared memory needs. The key is
// uint32 because statfs reports the type as a signed 32 bit integer on 32 bit
// architectures, where magics above 0x7fffffff would read as negative.
var walFilesystems = map[uint32]string{
	unix.EXT4_SUPER_MAGIC:  "ext2/3/4",
	unix.XFS_SUPER_MAGIC:   "xfs",
	unix.BTRFS_SUPER_MAGIC: "btrfs",
	unix.F2FS_SUPER_MAGIC:  "f2fs",
	unix.TMPFS_MAGIC:       "tmpfs",
	// Safe because the database is created in the writable upper layer.
	unix.OVERLAYFS_SUPER_MAGIC: "overlayfs",
	zfsSuperMagic:              "zfs",
}

func filesystemSupportsWAL(path string) (string, bool) {
	// Statfs follows symlinks, so this reports the filesystem holding the target.
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return "unknown", false
	}

	return walFilesystem(uint32(stat.Type))
}

// Named only so the log line says which filesystem was detected rather than a magic
// number. WAL stays off on all of them.
var namedFilesystems = map[uint32]string{
	unix.NFS_SUPER_MAGIC:  "nfs",
	unix.CIFS_SUPER_MAGIC: "cifs",
	unix.SMB_SUPER_MAGIC:  "smb",
	unix.SMB2_SUPER_MAGIC: "smb2",
	unix.FUSE_SUPER_MAGIC: "fuse",
	unix.CEPH_SUPER_MAGIC: "ceph",
}

func walFilesystem(fsType uint32) (string, bool) {
	if name, ok := walFilesystems[fsType]; ok {
		return name, true
	}

	if name, ok := namedFilesystems[fsType]; ok {
		return name, false
	}

	return fmt.Sprintf("0x%x", fsType), false
}
