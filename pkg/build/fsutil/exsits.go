package fsutil

import "os"

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
