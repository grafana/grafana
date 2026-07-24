package services

import (
	"io/fs"
	"os"
)

type IoUtilImp struct {
}

func (i IoUtilImp) Stat(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func (i IoUtilImp) RemoveAll(path string) error {
	return os.RemoveAll(path)
}

func (i IoUtilImp) ReadDir(path string) ([]fs.DirEntry, error) {
	return os.ReadDir(path)
}

func (i IoUtilImp) ReadFile(filename string) ([]byte, error) {
	// We can ignore the gosec G304 warning on this one, since the variable part of the file path stems
	// from command line flag "pluginsDir". If the user shouldn't be reading from this directory, they shouldn't have
	// the permission in the file system.
	// nolint:gosec
	return os.ReadFile(filename)
}
