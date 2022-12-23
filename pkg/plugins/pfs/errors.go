package pfs

import "errors"

// ErrEmptyFS indicates that the fs.FS provided to ParsePluginFS was empty.
var ErrEmptyFS = errors.New("provided fs.FS is empty")

// ErrNoRootFile indicates that no root plugin.json file exists.
var ErrNoRootFile = errors.New("no plugin.json at root of fs.fS")

// ErrInvalidRootFile indicates that the root plugin.json file is invalid.
var ErrInvalidRootFile = errors.New("plugin.json is invalid")

// ErrComposableNotExpected indicates that a plugin has a composable kind for a
// schema interface that is not expected, given the type of the plugin. (For
// example, a datasource plugin has a panelcfg composable kind)
var ErrComposableNotExpected = errors.New("plugin type should not produce composable kind for schema interface")

// ErrExpectedComposable indicates that a plugin lacks a composable kind
// implementation for a schema interface that is expected for that plugin's
// type. (For example, a datasource plugin lacks a queries composable kind)
var ErrExpectedComposable = errors.New("plugin type should produce composable kind for schema interface")

// ErrInvalidCUE indicates that a plugin's model.cue file contained invalid CUE.
var ErrInvalidCUE = errors.New("CUE syntax error")

// ErrInvalidLineage indicates that the plugin contains an invalid lineage
// declaration, according to Thema's validation rules in
// ["github.com/grafana/thema".BindLineage].
var ErrInvalidLineage = errors.New("invalid lineage")

// ErrLineageNameMismatch indicates a plugin slot lineage name did not match the id of the plugin.
var ErrLineageNameMismatch = errors.New("lineage name not the same as plugin id")

// ErrDisallowedCUEImport indicates that a plugin's models.cue file CUEImports a
// CUE package that is not on the whitelist for safe CUEImports.
var ErrDisallowedCUEImport = errors.New("CUE import is not allowed")
