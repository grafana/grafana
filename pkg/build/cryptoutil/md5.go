package cryptoutil

import (
	"crypto/md5"
	"fmt"
	"io"
	"io/ioutil"
	"os"
)

func MD5File(fpath string) error {
	fd, err := os.Open(fpath)
	if err != nil {
		return err
	}
	defer fd.Close()

	h := md5.New() // nolint:gosec
	if _, err = io.Copy(h, fd); err != nil {
		return err
	}

	// nolint:gosec
	if err := ioutil.WriteFile(fpath+".md5", []byte(fmt.Sprintf("%x\n", h.Sum(nil))), 0664); err != nil {
		return err
	}

	return nil
}
