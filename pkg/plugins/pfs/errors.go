package pfs

import "errors"

// ErrEmptyFS indicates that the fs.FS provided to ParsePluginFS was empty.
var ErrEmptyFS = errors.New("provided fs.FS is empty")

// ErrNoRootFile indicates that no root plugin.json file exists.
var ErrNoRootFile = errors.New("no plugin.json at root of fs.fS")

// ErrInvalidRootFile indicates that the root plugin.json file is invalid.
var ErrInvalidRootFile = errors.New("plugin.json is invalid")
