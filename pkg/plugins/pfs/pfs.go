package pfs

import (
	"errors"
	"io/fs"
)

// Tree represents the contents of a plugin filesystem tree.
type Tree struct {
	raw fs.FS
}

// ParsePluginFS takes an fs.FS and checks that it represents exactly one valid
// plugin fs tree. It does not descend into subdirectories to search for additional
// plugin roots (as indicated by plugin.json files).
func ParsePluginFS(f fs.FS) (*Tree, error) {
	if f == nil {
		return nil, ErrEmptyFS
	}

	var err error
	var pf fs.File
	if pf, err = f.Open("plugin.json"); err != nil && errors.Is(err, fs.ErrNotExist) {
		return nil, ErrNoRootFile
	}
}
