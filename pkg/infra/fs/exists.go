package fs

import (
	"os"
)

// Exists determines whether a file/directory exists or not.
func Exists(fpath string) (bool, error) {
	_, err := os.Stat(fpath)
	if err != nil {
		if !os.IsNotExist(err) {
			return false, err
		}
		return false, nil
	}

	return true, nil
}

// Equal determines whether two paths are the same.
func Equal(p1, p2 string) bool {
	fi1, err := os.Stat(p1)
	if err != nil {
		return false
	}
	fi2, err := os.Stat(p2)
	if err != nil {
		return false
	}

	return os.SameFile(fi1, fi2)
}
