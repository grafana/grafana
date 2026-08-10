package sqlstore

import (
	"fmt"
	"path/filepath"

	"golang.org/x/sys/windows"
)

var driveTypeNames = map[uint32]string{
	windows.DRIVE_UNKNOWN:     "unknown drive",
	windows.DRIVE_NO_ROOT_DIR: "invalid drive",
	windows.DRIVE_REMOVABLE:   "removable drive",
	windows.DRIVE_FIXED:       "fixed drive",
	windows.DRIVE_REMOTE:      "network drive",
	windows.DRIVE_CDROM:       "CD-ROM drive",
	windows.DRIVE_RAMDISK:     "RAM disk",
}

// Drives local to this computer, which is what WAL's shared memory needs. Mapped
// network drives and UNC paths report DRIVE_REMOTE and are left out.
var walDriveTypes = map[uint32]bool{
	windows.DRIVE_FIXED:   true,
	windows.DRIVE_RAMDISK: true,
}

func filesystemSupportsWAL(path string) (string, bool) {
	driveType, err := driveTypeOf(path)
	if err != nil {
		return "unknown", false
	}

	name, ok := driveTypeNames[driveType]
	if !ok {
		name = fmt.Sprintf("drive type %d", driveType)
	}

	return name, walDriveTypes[driveType]
}

func driveTypeOf(name string) (uint32, error) {
	abs, err := filepath.Abs(name)
	if err != nil {
		return 0, err
	}

	path, err := windows.UTF16PtrFromString(abs)
	if err != nil {
		return 0, err
	}

	// GetDriveType needs the root of the volume, not the directory itself.
	root := make([]uint16, windows.MAX_PATH+1)
	if err := windows.GetVolumePathName(path, &root[0], uint32(len(root))); err != nil {
		return 0, err
	}

	return windows.GetDriveType(&root[0]), nil
}
