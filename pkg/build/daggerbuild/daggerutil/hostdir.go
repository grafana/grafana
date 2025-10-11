package daggerutil

import (
	"errors"
	"os"

	"dagger.io/dagger"
)

// HostDir checks that the directory at 'path' exists and returns the dagger.Directory at 'path'.
func HostDir(d *dagger.Client, path string, opts ...dagger.HostDirectoryOpts) (*dagger.Directory, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	if !info.IsDir() {
		return nil, errors.New("given hostdir is not a directory")
	}

	return d.Host().Directory(path, opts...), nil
}
