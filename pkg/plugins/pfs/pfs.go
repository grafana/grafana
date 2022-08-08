package pfs

import (
	"errors"
	"fmt"
	"io/fs"

	"github.com/grafana/grafana/pkg/coremodel/pluginmeta"
	"github.com/grafana/grafana/pkg/framework/coremodel/registry"
	"github.com/grafana/thema"
	"github.com/grafana/thema/vmux"
)

// Tree represents the contents of a plugin filesystem tree.
type Tree struct {
	raw   fs.FS
	rootp pluginmeta.Model
}

var pm = registry.NewBase().Pluginmeta()
var tsch thema.TypedSchema[pluginmeta.Model]
var plugmux vmux.ValueMux[pluginmeta.Model]

func init() {
	// TODO these are easily generalizable in pkg/f/coremodel, no need for one-off
	var err error
	tsch, err = thema.BindType[pluginmeta.Model](pm.CurrentSchema())
	if err != nil {
		panic(err)
	}
	plugmux = vmux.NewValueMux(tsch, vmux.NewJSONEndec("plugin.json"))
}

// ParsePluginFS takes an fs.FS and checks that it represents exactly one valid
// plugin fs tree. It does not descend into subdirectories to search for additional
// plugin.json files.
func ParsePluginFS(f fs.FS) (*Tree, error) {
	if f == nil {
		return nil, ErrEmptyFS
	}

	var err error
	var pf fs.File
	if pf, err = f.Open("plugin.json"); err != nil && errors.Is(err, fs.ErrNotExist) {
		return nil, ErrNoRootFile
	}

	b := make([]byte, 0)
	_, err = pf.Read(b)
	if err != nil {
		return nil, fmt.Errorf("error reading plugin.json: %w", err)
	}
	tree := &Tree{
		raw: f,
	}

	// Pass the raw bytes into the muxer, get the a populated Model type out that we want
	// Ignore the second return (lacunas) for now, that system is under development
	tree.rootp, _, err = plugmux(b)
	if err != nil {
		// TODO more nuanced error handling by class of Thema failure
		return nil, fmt.Errorf("plugin.json was invalid: %w", err)
	}

	// TODO pull out the models.cue, too
	// TODO what else?
	return tree, nil
}
