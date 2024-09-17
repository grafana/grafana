package fsutil

import (
	"fmt"
	"os"
	"path/filepath"
)

// CopyRecursive copies files and directories recursively.
func CopyRecursive(src, dst string) error {
	sfi, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !sfi.IsDir() {
		return CopyFile(src, dst)
	}

	if _, err := os.Stat(dst); os.IsNotExist(err) {
		if err := os.MkdirAll(dst, sfi.Mode()); err != nil {
			return fmt.Errorf("failed to create directory %q: %s", dst, err)
		}
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		srcFi, err := os.Stat(srcPath)
		if err != nil {
			return err
		}

		switch srcFi.Mode() & os.ModeType {
		case os.ModeDir:
			if err := CopyRecursive(srcPath, dstPath); err != nil {
				return err
			}
		case os.ModeSymlink:
			link, err := os.Readlink(srcPath)
			if err != nil {
				return err
			}
			if err := os.Symlink(link, dstPath); err != nil {
				return err
			}
		default:
			if err := CopyFile(srcPath, dstPath); err != nil {
				return err
			}
		}

		if srcFi.Mode()&os.ModeSymlink != 0 {
			if err := os.Chmod(dstPath, srcFi.Mode()); err != nil {
				return err
			}
		}
	}

	return nil
}
