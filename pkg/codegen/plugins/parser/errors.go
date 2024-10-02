package parser

import "errors"

// ErrEmptyFS indicates that the fs.FS provided to ParsePluginFS was empty.
var ErrEmptyFS = errors.New("provided fs.FS is empty")

// ErrNoRootFile indicates that no root plugin.json file exists.
var ErrNoRootFile = errors.New("no plugin.json at root of fs.fS")

// ErrInvalidRootFile indicates that the root plugin.json file is invalid.
var ErrInvalidRootFile = errors.New("plugin.json is invalid")

// ErrInvalidGrafanaPluginInstance indicates a plugin's set of .cue
// grafanaplugin package files are invalid with respect to the GrafanaPlugin
// spec.
var ErrInvalidGrafanaPluginInstance = errors.New("grafanaplugin cue instance is invalid")

// ErrDisallowedCUEImport indicates that a plugin's grafanaplugin cue package
// contains that are not on the allowlist.
var ErrDisallowedCUEImport = errors.New("CUE import is not allowed")
