package pfs

import (
	"errors"
	"io/fs"

	"github.com/grafana/grafana/pkg/coremodel/pluginmeta"
	"github.com/grafana/grafana/pkg/framework/coremodel/registry"
)

// Tree represents the contents of a plugin filesystem tree.
type Tree struct {
	raw   fs.FS
	rootp pluginmeta.Model
}

var pm = registry.NewBase()

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
