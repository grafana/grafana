//go:build !windows
// +build !windows

package pq

import (
	"errors"
	"os"
	"syscall"
)

const (
	rootUserID = uint32(0)

	// The maximum permissions that a private key file owned by a regular user
	// is allowed to have. This translates to u=rw.
	maxUserOwnedKeyPermissions os.FileMode = 0600

	// The maximum permissions that a private key file owned by root is allowed
	// to have. This translates to u=rw,g=r.
	maxRootOwnedKeyPermissions os.FileMode = 0640
)

var (
	errSSLKeyHasUnacceptableUserPermissions = errors.New("permissions for files not owned by root should be u=rw (0600) or less")
	errSSLKeyHasUnacceptableRootPermissions = errors.New("permissions for root owned files should be u=rw,g=r (0640) or less")
)

// sslKeyPermissions checks the permissions on user-supplied ssl key files.
// The key file should have very little access.
//
// libpq does not check key file permissions on Windows.
func sslKeyPermissions(sslkey string) error {
	info, err := os.Stat(sslkey)
	if err != nil {
		return err
	}

	err = hasCorrectPermissions(info)

	// return ErrSSLKeyHasWorldPermissions for backwards compatability with
	// existing code.
	if err == errSSLKeyHasUnacceptableUserPermissions || err == errSSLKeyHasUnacceptableRootPermissions {
		err = ErrSSLKeyHasWorldPermissions
	}
	return err
}

// hasCorrectPermissions checks the file info (and the unix-specific stat_t
// output) to verify that the permissions on the file are correct.
//
// If the file is owned by the same user the process is running as,
// the file should only have 0600 (u=rw). If the file is owned by root,
// and the group matches the group that the process is running in, the
// permissions cannot be more than 0640 (u=rw,g=r). The file should
// never have world permissions.
//
// Returns an error when the permission check fails.
func hasCorrectPermissions(info os.FileInfo) error {
	// if file's permission matches 0600, allow access.
	userPermissionMask := (os.FileMode(0777) ^ maxUserOwnedKeyPermissions)

	// regardless of if we're running as root or not, 0600 is acceptable,
	// so we return if we match the regular user permission mask.
	if info.Mode().Perm()&userPermissionMask == 0 {
		return nil
	}

	// We need to pull the Unix file information to get the file's owner.
	// If we can't access it, there's some sort of operating system level error
	// and we should fail rather than attempting to use faulty information.
	sysInfo := info.Sys()
	if sysInfo == nil {
		return ErrSSLKeyUnknownOwnership
	}

	unixStat, ok := sysInfo.(*syscall.Stat_t)
	if !ok {
		return ErrSSLKeyUnknownOwnership
	}

	// if the file is owned by root, we allow 0640 (u=rw,g=r) to match what
	// Postgres does.
	if unixStat.Uid == rootUserID {
		rootPermissionMask := (os.FileMode(0777) ^ maxRootOwnedKeyPermissions)
		if info.Mode().Perm()&rootPermissionMask != 0 {
			return errSSLKeyHasUnacceptableRootPermissions
		}
		return nil
	}

	return errSSLKeyHasUnacceptableUserPermissions
}
