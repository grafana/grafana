package build

import (
	"crypto/md5"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func shaDir(dir string) {
	filepath.Walk(dir, func(path string, f os.FileInfo, err error) error {
		if path == dir {
			return nil
		}

		if strings.Contains(path, ".sha256") {
			return nil
		}
		if err := shaFile(path); err != nil {
			log.Printf("Failed to create sha file. error: %v\n", err)
		}
		return nil
	})
}

func shaFile(file string) error {
	r, err := os.Open(file)
	if err != nil {
		return err
	}
	defer r.Close()

	h := sha256.New()
	_, err = io.Copy(h, r)
	if err != nil {
		return err
	}

	out, err := os.Create(file + ".sha256")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(out, "%x\n", h.Sum(nil))
	if err != nil {
		return err
	}

	return out.Close()
}

func md5File(file string) error {
	fd, err := os.Open(file)
	if err != nil {
		return err
	}
	defer fd.Close()

	h := md5.New()
	_, err = io.Copy(h, fd)
	if err != nil {
		return err
	}

	out, err := os.Create(file + ".md5")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(out, "%x\n", h.Sum(nil))
	if err != nil {
		return err
	}

	return out.Close()
}

// basically `rm -r`s the list of files provided
func rmr(paths ...string) {
	for _, path := range paths {
		log.Println("rm -r", path)
		os.RemoveAll(path)
	}
}
