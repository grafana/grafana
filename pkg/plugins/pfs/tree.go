package pfs

import (
	"io/fs"
)

// Tree represents the contents of a plugin filesystem tree.
type Tree struct {
	raw      fs.FS
	rootinfo ParsedPlugin
}

func (t *Tree) FS() fs.FS {
	return t.raw
}

func (t *Tree) RootPlugin() ParsedPlugin {
	return t.rootinfo
}

// SubPlugins returned a map of the PluginInfos for subplugins
// within the tree, if any, keyed by subpath.
func (t *Tree) SubPlugins() map[string]ParsedPlugin {
	// TODO implement these once ParsePluginFS descends
	return nil
}
