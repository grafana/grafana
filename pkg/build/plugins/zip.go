package plugins

import (
	"archive/zip"
	"io"
	"log"
	"os"
	"path/filepath"
)

// Unzip unzips a plugin.
func Unzip(fpath, tgtDir string) error {
	log.Printf("Unzipping plugin %q into %q...", fpath, tgtDir)

	r, err := zip.OpenReader(fpath)
	if err != nil {
		return err
	}
	defer logCloseError(r.Close)

	// Closure to address file descriptors issue with all the deferred .Close() methods
	extractAndWriteFile := func(f *zip.File) error {
		log.Printf("Extracting zip member %q...", f.Name)

		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer logCloseError(rc.Close)

		//nolint:gosec
		dstPath := filepath.Join(tgtDir, f.Name)

		if f.FileInfo().IsDir() {
			return os.MkdirAll(dstPath, f.Mode())
		}

		if err := os.MkdirAll(filepath.Dir(dstPath), f.Mode()); err != nil {
			return err
		}

		//nolint:gosec
		fd, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}
		defer logCloseError(fd.Close)

		// nolint:gosec
		if _, err := io.Copy(fd, rc); err != nil {
			return err
		}

		return fd.Close()
	}

	for _, f := range r.File {
		if err := extractAndWriteFile(f); err != nil {
			return err
		}
	}

	return nil
}
