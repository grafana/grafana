package compilers

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

const (
	ArmV6        = "/opt/rpi-tools/arm-bcm2708/arm-linux-gnueabihf/bin/arm-linux-gnueabihf-gcc"
	Armv7        = "arm-linux-gnueabihf-gcc"
	Armv7Musl    = "/tmp/arm-linux-musleabihf-cross/bin/arm-linux-musleabihf-gcc"
	Arm64        = "aarch64-linux-gnu-gcc"
	Arm64Musl    = "/tmp/aarch64-linux-musl-cross/bin/aarch64-linux-musl-gcc"
	Osx64        = "/tmp/osxcross/target/bin/o64-clang"
	Win64        = "x86_64-w64-mingw32-gcc"
	LinuxX64     = "/tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc"
	LinuxX64Musl = "/tmp/x86_64-linux-musl-cross/bin/x86_64-linux-musl-gcc"
)

func Install() error {
	// From the os.TempDir documentation:
	// On Unix systems, it returns $TMPDIR if non-empty,
	// else /tmp. On Windows, it uses GetTempPath,
	// returning the first non-empty value from %TMP%, %TEMP%, %USERPROFILE%,
	// or the Windows directory. On Plan 9, it returns /tmp.
	tmp := os.TempDir()

	var (
		centosArchive = "x86_64-centos6-linux-gnu.tar.xz"
		osxArchive    = "osxcross.tar.xz"
	)

	for _, fname := range []string{centosArchive, osxArchive} {
		path := filepath.Join(tmp, fname)
		if _, err := os.Stat(path); err != nil {
			return fmt.Errorf("stat error: %w", err)
		}
		// Ignore gosec G204 as this function is only used in the build process.
		//nolint:gosec
		cmd := exec.Command("tar", "xfJ", fname)
		cmd.Dir = tmp
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to unpack %q: %q, %w", fname, output, err)
		}
	}

	return nil
}
