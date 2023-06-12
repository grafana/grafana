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

// ErrInvalidGrafanaPluginInstance indicates a plugin's set of .cue
// grafanaplugin package files are invalid with respect to the GrafanaPlugin
// spec.
var ErrInvalidGrafanaPluginInstance = errors.New("grafanaplugin cue instance is invalid")

// ErrInvalidLineage indicates that the plugin contains an invalid lineage
// declaration, according to Thema's validation rules in
// ["github.com/grafana/thema".BindLineage].
var ErrInvalidLineage = errors.New("invalid lineage")

// ErrDisallowedCUEImport indicates that a plugin's grafanaplugin cue package
// contains that are not on the allowlist.
var ErrDisallowedCUEImport = errors.New("CUE import is not allowed")
