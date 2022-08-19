package pfs

import "errors"

// ErrEmptyFS indicates that the fs.FS provided to ParsePluginFS was empty.
var ErrEmptyFS = errors.New("provided fs.FS is empty")

// ErrNoRootFile indicates that no root plugin.json file exists.
var ErrNoRootFile = errors.New("no plugin.json at root of fs.fS")

// ErrInvalidRootFile indicates that the root plugin.json file is invalid.
var ErrInvalidRootFile = errors.New("plugin.json is invalid")

// ErrImplementedSlots indicates that a plugin has implemented the wrong set of
// slots for its type in models.cue. Either:
//   - A slot is implemented that is not allowed for its type (e.g. datasource plugin implements Panel)
//   - A required slot for its type is not implemented (e.g. panel plugin does not implemented Panel)
var ErrImplementedSlots = errors.New("slot implementation not allowed for this plugin type")

// ErrInvalidLineage indicates that the plugin contains an invalid lineage
// declaration, according to Thema's validation rules in
// ["github.com/grafana/thema".BindLineage].
var ErrInvalidLineage = errors.New("invalid lineage")

// ErrLineageNameMismatch indicates a plugin slot lineage name did not match the id of the plugin.
var ErrLineageNameMismatch = errors.New("lineage name not the same as plugin id")

// ErrDisallowedCUEImport indicates that a plugin's models.cue file imports a
// CUE package that is not on the whitelist for safe imports.
var ErrDisallowedCUEImport = errors.New("CUE import is not allowed")
