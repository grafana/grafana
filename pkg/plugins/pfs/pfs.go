package pfs

import (
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/parser"
	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/coremodel/pluginmeta"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/grafana/pkg/framework/coremodel/registry"
	"github.com/grafana/thema"
	"github.com/grafana/thema/kernel"
	"github.com/grafana/thema/load"
	"github.com/yalue/merged_fs"
)

// PermittedCUEImports returns the list of packages that may be imported in a
// plugin models.cue file.
func PermittedCUEImports() []string {
	return []string{
		"github.com/grafana/thema",
		"github.com/grafana/grafana/packages/grafana-schema/src/schema",
	}
}

func importAllowed(path string) bool {
	for _, p := range PermittedCUEImports() {
		if p == path {
			return true
		}
	}
	return false
}

var allowedImportsStr string

// Name expected to be used for all models.cue files in Grafana plugins
const pkgname = "grafanaplugin"

type slotandname struct {
	name string
	slot *coremodel.Slot
}

var allslots []slotandname

var plugmux kernel.InputKernel

// TODO re-enable after go1.18
// var tsch thema.TypedSchema[pluginmeta.Model]
// var plugmux vmux.ValueMux[pluginmeta.Model]

func init() {
	var all []string
	for _, im := range PermittedCUEImports() {
		all = append(all, fmt.Sprintf("\t%s", im))
	}
	allowedImportsStr = strings.Join(all, "\n")

	for n, s := range coremodel.AllSlots() {
		allslots = append(allslots, slotandname{
			name: n,
			slot: s,
		})
	}

	sort.Slice(allslots, func(i, j int) bool {
		return allslots[i].name < allslots[j].name
	})
}

var muxonce sync.Once

func loadMux() kernel.InputKernel {
	muxonce.Do(func() {
		plugmux = coremodel.Mux(registry.NewBase().Pluginmeta(), coremodel.Filename("plugin.json"))
	})
	return plugmux
}

// This used to be in init(), but that creates a risk for codegen.
//
// thema.BindType ensures that Go type and Thema schema are aligned. If we were
// to call it during init(), then the code generator that fixes misalignments
// between those two could trigger it if it depends on this package. That would
// mean that schema changes to pluginmeta get caught in a loop where the codegen
// process can't heal itself.
//
// In theory, that dependency shouldn't exist - this package should only be
// imported for plugin codegen, which should all happen after coremodel codegen.
// But in practice, it might exist. And it's really brittle and confusing to
// fix if that does happen.
//
// Better to be resilient to the possibility instead. So, this is a standalone function,
// called as needed to get our muxer, and internally relies on a sync.Once to avoid
// repeated processing of thema.BindType.
// TODO mux loading is easily generalizable in pkg/f/coremodel, shouldn't need one-off
// TODO switch to this generic signature after go1.18
// func loadMux() (thema.TypedSchema[pluginmeta.Model], vmux.ValueMux[pluginmeta.Model]) {
// 	muxonce.Do(func() {
// 		var err error
// 		var t pluginmeta.Model
// 		tsch, err = thema.BindType[pluginmeta.Model](pm.CurrentSchema(), t)
// 		if err != nil {
// 			panic(err)
// 		}
// 		plugmux = vmux.NewValueMux(tsch, vmux.NewJSONEndec("plugin.json"))
// 	})
// 	return tsch, plugmux
// }

// Tree represents the contents of a plugin filesystem tree.
type Tree struct {
	raw      fs.FS
	rootinfo PluginInfo
}

func (t *Tree) FS() fs.FS {
	return t.raw
}

func (t *Tree) RootPlugin() PluginInfo {
	return t.rootinfo
}

// SubPlugins returned a map of the PluginInfos for subplugins
// within the tree, if any, keyed by subpath.
func (t *Tree) SubPlugins() map[string]PluginInfo {
	panic("TODO")
}

// PluginInfo represents everything knowable about a single plugin from static
// analysis of its filesystem tree contents.
type PluginInfo struct {
	meta      pluginmeta.Model
	slotimpls map[string]thema.Lineage
	imports   []*ast.ImportSpec
}

// CUEImports lists the CUE import statements in the plugin's models.cue file,
// if any.
func (pi PluginInfo) CUEImports() []*ast.ImportSpec {
	return pi.imports
}

// SlotImplementations returns a map of the plugin's Thema lineages that
// implement particular slots, keyed by the name of the slot.
//
// Returns an empty map if the plugin has not implemented any slots.
func (pi PluginInfo) SlotImplementations() map[string]thema.Lineage {
	return pi.slotimpls
}

// Meta returns the metadata declared in the plugin's plugin.json file.
func (pi PluginInfo) Meta() pluginmeta.Model {
	return pi.meta
}

// ParsePluginFS takes an fs.FS and checks that it represents exactly one valid
// plugin fs tree, with the fs.FS root as the root of the tree.
//
// It does not descend into subdirectories to search for additional
// plugin.json files.
// TODO no descent is ok for core plugins, but won't cut it in general
func ParsePluginFS(f fs.FS, lib thema.Library) (*Tree, error) {
	if f == nil {
		return nil, ErrEmptyFS
	}
	// _, mux := loadMux()
	mux := loadMux()
	ctx := lib.Context()

	b, err := fs.ReadFile(f, "plugin.json")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, ErrNoRootFile
		}
		return nil, fmt.Errorf("error reading plugin.json: %w", err)
	}

	tree := &Tree{
		raw: f,
		rootinfo: PluginInfo{
			slotimpls: make(map[string]thema.Lineage),
		},
	}
	r := &tree.rootinfo

	// Pass the raw bytes into the muxer, get the populated Model type out that we want.
	// TODO stop ignoring second return. (for now, lacunas are a WIP and can't occur until there's >1 schema in the pluginmeta lineage)
	metaany, _, err := mux.Converge(b)
	if err != nil {
		// TODO more nuanced error handling by class of Thema failure
		// return nil, fmt.Errorf("plugin.json was invalid: %w", err)
		return nil, ewrap(err, ErrInvalidRootFile)
	}
	r.meta = *metaany.(*pluginmeta.Model)

	if modbyt, err := fs.ReadFile(f, "models.cue"); err == nil {
		// TODO introduce layered CUE dependency-injecting loader
		//
		// Until CUE has proper dependency management (and possibly even after), loading
		// CUE files with non-stdlib imports requires injecting the imported packages
		// into cue.mod/pkg/<import path>, unless the imports are within the same CUE
		// module. Thema introduced a system for this for its dependers, which we use
		// here, but we'll need to layer the same on top for importable Grafana packages.
		// Needing to do this twice strongly suggests it needs a generic, standalone
		// library.

		mfs := merged_fs.NewMergedFS(f, grafana.CueSchemaFS)

		// Note that this actually will load any .cue files in the fs.FS root dir in the pkgname.
		// That's...maybe good? But not what it says on the tin
		bi, err := load.InstancesWithThema(mfs, "", load.Package(pkgname))
		if err != nil {
			return nil, fmt.Errorf("loading models.cue failed: %w", err)
		}

		pf, _ := parser.ParseFile("models.cue", modbyt, parser.ParseComments)

		for _, im := range pf.Imports {
			ip := strings.Trim(im.Path.Value, "\"")
			if !importAllowed(ip) {
				return nil, ewrap(errors.Newf(im.Pos(), "import %q in models.cue not allowed, plugins may only import from:\n%s\n", ip, allowedImportsStr), ErrDisallowedCUEImport)
			}
			r.imports = append(r.imports, im)
		}

		val := ctx.BuildInstance(bi)
		for _, s := range allslots {
			iv := val.LookupPath(cue.ParsePath(s.slot.Name()))
			lin, err := bindSlotLineage(iv, s.slot, r.meta, lib)
			if lin != nil {
				r.slotimpls[s.slot.Name()] = lin
			}
			if err != nil {
				return nil, err
			}
		}
	}

	return tree, nil
}

func bindSlotLineage(v cue.Value, s *coremodel.Slot, meta pluginmeta.Model, lib thema.Library) (thema.Lineage, error) {
	accept, required := s.ForPluginType(string(meta.Type))
	exists := v.Exists()

	if !accept {
		if exists {
			// If it's not accepted for the type, but is declared, error out. This keeps a
			// precise boundary on what's actually expected for plugins to do, which makes
			// for clearer docs and guarantees for users.
			return nil, ewrap(fmt.Errorf("%s: %s plugins may not provide a %s slot implementation in models.cue", meta.Id, meta.Type, s.Name()), ErrImplementedSlots)
		}
		return nil, nil
	}

	if !exists && required {
		return nil, ewrap(fmt.Errorf("%s: %s plugins must provide a %s slot implementation in models.cue", meta.Id, meta.Type, s.Name()), ErrImplementedSlots)
	}

	// TODO make this opt real in thema, then uncomment to enforce joinSchema
	// lin, err := thema.BindLineage(iv, lib, thema.SatisfiesJoinSchema(s.MetaSchema()))
	lin, err := thema.BindLineage(v, lib)
	if err != nil {
		return nil, ewrap(fmt.Errorf("%s: invalid thema lineage for slot %s: %w", meta.Id, s.Name(), err), ErrInvalidLineage)
	}

	sanid := sanitizePluginId(meta.Id)
	if lin.Name() != sanid {
		errf := func(format string, args ...interface{}) error {
			var errin error
			if n := v.LookupPath(cue.ParsePath("name")).Source(); n != nil {
				errin = errors.Newf(n.Pos(), format, args...)
			} else {
				errin = fmt.Errorf(format, args...)
			}
			return ewrap(errin, ErrLineageNameMismatch)
		}
		if sanid != meta.Id {
			return nil, errf("%s: %q slot lineage name must be the sanitized plugin id (%q), got %q", meta.Id, s.Name(), sanid, lin.Name())
		} else {
			return nil, errf("%s: %q slot lineage name must be the plugin id, got %q", meta.Id, s.Name(), lin.Name())
		}
	}
	return lin, nil
}

// Plugin IDs are allowed to contain characters that aren't allowed in thema
// Lineage names, CUE package names, Go package names, TS or Go type names, etc.
func sanitizePluginId(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			fallthrough
		case r >= 'A' && r <= 'Z':
			fallthrough
		case r >= '0' && r <= '9':
			fallthrough
		case r == '_':
			return r
		case r == '-':
			return '_'
		default:
			return -1
		}
	}, s)
}

func ewrap(actual, is error) error {
	return &errPassthrough{
		actual: actual,
		is:     is,
	}
}

type errPassthrough struct {
	actual error
	is     error
}

func (e *errPassthrough) Is(err error) bool {
	return errors.Is(err, e.actual) || errors.Is(err, e.is)
}

func (e *errPassthrough) Error() string {
	return e.actual.Error()
}
