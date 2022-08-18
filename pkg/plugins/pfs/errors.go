package pfs

import "errors"

// ErrEmptyFS indicates that the fs.FS provided to ParsePluginFS was empty.
var ErrEmptyFS = errors.New("provided fs.FS is empty")

// ErrNoRootFile indicates that no root plugin.json file exists.
var ErrNoRootFile = errors.New("no plugin.json at root of fs.fS")

// ErrInvalidRootFile indicates that the root plugin.json file is invalid.
var ErrInvalidRootFile = errors.New("plugin.json is invalid")

// ErrSlotImplementationNotAllowed indicates that a plugin's models.cue file
// implements a slot that is not allowed for the plugin's type.
var ErrSlotImplementationNotAllowed = errors.New("slot implementation not allowed for this plugin type")

// ErrInvalidLineage indicates that the plugin contains an invalid lineage
// declaration, according to Thema's validation rules in
// ["github.com/grafana/thema".BindLineage].
var ErrInvalidLineage = errors.New("invalid lineage")

// ErrLineageNameMismatch indicates a plugin slot lineage name did not match the id of the plugin.
var ErrLineageNameMismatch = errors.New("lineage name not the same as plugin id")
