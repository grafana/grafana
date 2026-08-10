package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"golang.org/x/sys/unix"
)

func TestWALFilesystem(t *testing.T) {
	tests := []struct {
		fsType    uint32
		name      string
		supported bool
	}{
		{fsType: unix.EXT4_SUPER_MAGIC, name: "ext2/3/4", supported: true},
		{fsType: unix.TMPFS_MAGIC, name: "tmpfs", supported: true},
		{fsType: unix.OVERLAYFS_SUPER_MAGIC, name: "overlayfs", supported: true},
		{fsType: unix.BTRFS_SUPER_MAGIC, name: "btrfs", supported: true},
		{fsType: zfsSuperMagic, name: "zfs", supported: true},
		{fsType: unix.NFS_SUPER_MAGIC, name: "nfs", supported: false},
		{fsType: unix.CIFS_SUPER_MAGIC, name: "cifs", supported: false},
		{fsType: unix.SMB2_SUPER_MAGIC, name: "smb2", supported: false},
		{fsType: unix.FUSE_SUPER_MAGIC, name: "fuse", supported: false},
		{fsType: unix.CEPH_SUPER_MAGIC, name: "ceph", supported: false},
		{fsType: 0xdeadbeef, name: "0xdeadbeef", supported: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			name, supported := walFilesystem(tc.fsType)
			assert.Equal(t, tc.name, name)
			assert.Equal(t, tc.supported, supported)
		})
	}
}

func TestFilesystemSupportsWALProcfs(t *testing.T) {
	// procfs stands in for any filesystem missing from the allow list.
	name, supported := filesystemSupportsWAL("/proc")
	assert.False(t, supported)
	assert.Equal(t, "0x9fa0", name)
}

func TestFilesystemSupportsWALMissingPath(t *testing.T) {
	name, supported := filesystemSupportsWAL("/does/not/exist")
	assert.False(t, supported)
	assert.Equal(t, "unknown", name)
}
