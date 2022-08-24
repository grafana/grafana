package cryptoutil

import (
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"os"
)

func MD5File(fpath string) error {
	// Ignore gosec G304 as this function is only used in the build process.
	//nolint:gosec
	fd, err := os.Open(fpath)
	if err != nil {
		return err
	}
	defer func() {
		if err := fd.Close(); err != nil {
			log.Printf("error closing file at '%s': %s", fpath, err.Error())
		}
	}()

	h := md5.New() // nolint:gosec
	if _, err = io.Copy(h, fd); err != nil {
		return err
	}

	// nolint:gosec
	if err := os.WriteFile(fpath+".md5", []byte(fmt.Sprintf("%x\n", h.Sum(nil))), 0664); err != nil {
		return err
	}

	return nil
}
