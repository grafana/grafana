package fsutil

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
)

// CopyFile copies a file from src to dst.
//
// If src and dst files exist, and are the same, then return success. Otherwise, attempt to create a hard link
// between the two files. If that fails, copy the file contents from src to dst.
func CopyFile(src, dst string) (err error) {
	absSrc, err := filepath.Abs(src)
	if err != nil {
		return fmt.Errorf("failed to get absolute path of source file %q: %w", src, err)
	}
	sfi, err := os.Stat(src)
	if err != nil {
		err = fmt.Errorf("couldn't stat source file %q: %w", absSrc, err)
		return
	}
	if !sfi.Mode().IsRegular() {
		// Cannot copy non-regular files (e.g., directories, symlinks, devices, etc.)
		return fmt.Errorf("non-regular source file %s (%q)", absSrc, sfi.Mode().String())
	}
	dpath := filepath.Dir(dst)
	exists, err := Exists(dpath)
	if err != nil {
		return err
	}
	if !exists {
		err = fmt.Errorf("destination directory doesn't exist: %q", dpath)
		return
	}

	var dfi os.FileInfo
	dfi, err = os.Stat(dst)
	if err != nil {
		if !os.IsNotExist(err) {
			return
		}
	} else {
		if !(dfi.Mode().IsRegular()) {
			return fmt.Errorf("non-regular destination file %s (%q)", dfi.Name(), dfi.Mode().String())
		}
		if os.SameFile(sfi, dfi) {
			return copyPermissions(sfi.Name(), dfi.Name())
		}
	}

	err = copyFileContents(src, dst)
	return err
}

// copyFileContents copies the contents of the file named src to the file named
// by dst. The file will be created if it does not already exist. If the
// destination file exists, all it's contents will be replaced by the contents
// of the source file.
func copyFileContents(src, dst string) (err error) {
	//nolint:gosec
	in, err := os.Open(src)
	if err != nil {
		return
	}
	defer func() {
		if err := in.Close(); err != nil {
			log.Println("error closing file", err)
		}
	}()

	//nolint:gosec
	out, err := os.Create(dst)
	if err != nil {
		return
	}
	defer func() {
		if cerr := out.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	if _, err = io.Copy(out, in); err != nil {
		return
	}

	if err := out.Sync(); err != nil {
		return err
	}

	return copyPermissions(src, dst)
}

func copyPermissions(src, dst string) error {
	sfi, err := os.Lstat(src)
	if err != nil {
		return err
	}

	if err := os.Chmod(dst, sfi.Mode()); err != nil {
		return err
	}

	return nil
}
