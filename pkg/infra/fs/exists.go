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

// NaiveEqual determines whether two paths are the same.
// if neither paths exist, compare as strings
// otherwise compare with os.SameFile
func NaiveEqual(p1, p2 string) bool {
	fi1, err1 := os.Stat(p1)
	fi2, err2 := os.Stat(p2)
	if err1 != nil {
		if err2 != nil {
			if os.IsNotExist(err1) && os.IsNotExist(err2) {
				return p1 == p2
			}
			return false
		}
	}
	if err2 != nil {
		return false
	}

	return os.SameFile(fi1, fi2)
}
