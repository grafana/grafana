package pfs

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/coremodel/pluginmeta"
	"github.com/grafana/grafana/pkg/framework/coremodel/registry"
	"github.com/grafana/grafana/pkg/framework/coremodel/slot"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
	"github.com/grafana/thema/vmux"
	"github.com/yalue/merged_fs"
)

// Tree represents the contents of a plugin filesystem tree.
type Tree struct {
	raw       fs.FS
	rootp     pluginmeta.Model
	slotimpls map[string]thema.Lineage
}

const pkgname = "grafanaplugin"

var pm = registry.NewBase().Pluginmeta()
var tsch thema.TypedSchema[pluginmeta.Model]
var plugmux vmux.ValueMux[pluginmeta.Model]
var slots = slot.All()

func init() {
	// TODO these are easily generalizable in pkg/f/coremodel, no need for one-off
	var err error
	var t pluginmeta.Model
	tsch, err = thema.BindType[pluginmeta.Model](pm.CurrentSchema(), t)
	if err != nil {
		panic(err)
	}
	plugmux = vmux.NewValueMux(tsch, vmux.NewJSONEndec("plugin.json"))
}

// ParsePluginFS takes an fs.FS and checks that it represents exactly one valid
// plugin fs tree.
//
// It does not descend into subdirectories to search for additional
// plugin.json files.
// TODO no descent is ok for core plugins, but won't cut it in general
func ParsePluginFS(f fs.FS, lib thema.Library) (*Tree, error) {
	if f == nil {
		return nil, ErrEmptyFS
	}
	ctx := lib.Context()

	b, err := fs.ReadFile(f, "plugin.json")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, ErrNoRootFile
		}
		return nil, fmt.Errorf("error reading plugin.json: %w", err)
	}

	tree := &Tree{
		raw:       f,
		slotimpls: make(map[string]thema.Lineage),
	}

	// Pass the raw bytes into the muxer, get the populated Model type out that we want.
	// TODO stop ignoring second return. (for now, lacunas are a WIP and can't occur until there's >1 schema in the pluginmeta lineage)
	tree.rootp, _, err = plugmux(b)
	if err != nil {
		// TODO more nuanced error handling by class of Thema failure
		return nil, fmt.Errorf("plugin.json was invalid: %w", err)
	}

	if _, err = fs.Stat(f, "models.cue"); err == nil {
		// TODO introduce layered CUE dependency-injecting loader
		//
		// Until CUE has proper dependency management (and possibly even after), loading
		// CUE files with non-stdlib imports requires injecting the imported packages
		// into cue.mod/pkg/<import path>, unless the imports are within the same CUE
		// module. Thema introduced a system for this for its dependers, which we use
		// here, but we'll need to layer the same on top for importable Grafana packages.
		// Needing to do this twice strongly suggests it needs a generic, standalone
		// library.
		//
		// However, we can ignore this for core Grafana plugins, because they're within
		// the same CUE module. That said, this approach to loading will give them a
		// misleading path (not their actual path relative to grafana repo root) in the
		// event of any errors.

		m := fstest.MapFS{
			// fstest can recognize only forward slashes.
			filepath.ToSlash(filepath.Join("cue.mod", "module.cue")): &fstest.MapFile{Data: []byte(`module: "github.com/grafana/grafana"`)},
		}
		mfs := merged_fs.NewMergedFS(m, f)

		// Note that this actually will load any .cue files in the fs.FS root dir in the pkgname.
		// That's...maybe good? But not what it says on the tin
		bi, err := load.InstancesWithThema(mfs, "", load.Package(pkgname))
		if err != nil {
			return nil, fmt.Errorf("loading models.cue failed: %w", err)
		}
		val := ctx.BuildInstance(bi)
		for _, s := range slots.List() {
			iv := val.LookupPath(cue.ParsePath(s.Name()))
			accept, required := s.ForPlugin(string(tree.rootp.Type))
			exists := iv.Exists()

			if !accept {
				if exists {
					// If it's not accepted for the type, but is declared, error out. This keeps a
					// precise boundary on what's actually expected for plugins to do, which makes
					// for clearer docs and guarantees for users.
					return nil, fmt.Errorf("%s: %s plugins must not provide a %s slot implementations in models.cue", tree.rootp.Id, tree.rootp.Type, s.Name())
				}
				continue
			}

			if !exists && required {
				return nil, fmt.Errorf("%s: %s plugins must provide a %s slot implementation in models.cue", tree.rootp.Id, tree.rootp.Type, s.Name())
			}

			// TODO make this opt real to enforce joinSchema
			// lin, err := thema.BindLineage(iv, lib, thema.SatisfiesJoinSchema(s.MetaSchema()))
			lin, err := thema.BindLineage(iv, lib)
			if err != nil {
				return nil, fmt.Errorf("%s: invalid thema lineage for slot %s: %w", tree.rootp.Id, s.Name(), err)
			}
			tree.slotimpls[s.Name()] = lin
		}
	}

	return tree, nil
}
