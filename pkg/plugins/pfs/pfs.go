package pfs

import (
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/parser"
	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
	"github.com/grafana/thema/vmux"
	"github.com/yalue/merged_fs"
)

// PermittedCUEImports returns the list of packages that may be imported in a
// plugin models.cue file.
//
// TODO probably move this into kindsys
func PermittedCUEImports() []string {
	return []string{
		"github.com/grafana/thema",
		"github.com/grafana/grafana/packages/grafana-schema/src/common",
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

type slotandname struct {
	name string
	slot kindsys.SchemaInterface
}

var allslots []slotandname

func init() {
	all := make([]string, 0, len(PermittedCUEImports()))
	for _, im := range PermittedCUEImports() {
		all = append(all, fmt.Sprintf("\t%s", im))
	}
	allowedImportsStr = strings.Join(all, "\n")

	for n, s := range kindsys.SchemaInterfaces(nil) {
		allslots = append(allslots, slotandname{
			name: n,
			slot: s,
		})
	}

	sort.Slice(allslots, func(i, j int) bool {
		return allslots[i].name < allslots[j].name
	})
}

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
	// TODO implement these once ParsePluginFS descends
	return nil
}

// TreeList is a slice of validated plugin fs Trees with helper methods
// for filtering to particular subsets of its members.
type TreeList []*Tree

// LineagesForSlot returns the set of plugin-defined lineages that implement a
// particular named Grafana slot (See ["github.com/grafana/grafana/pkg/framework/coremodel".SchemaInterface]).
func (tl TreeList) LineagesForSlot(slotname string) map[string]thema.Lineage {
	m := make(map[string]thema.Lineage)
	for _, tree := range tl {
		rootp := tree.RootPlugin()
		rid := rootp.Meta().Id

		if lin, has := rootp.SlotImplementations()[slotname]; has {
			m[rid] = lin
		}
	}

	return m
}

// PluginInfo represents everything knowable about a single plugin from static
// analysis of its filesystem tree contents.
type PluginInfo struct {
	meta      plugindef.PluginDef
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
func (pi PluginInfo) Meta() plugindef.PluginDef {
	return pi.meta
}

// ParsePluginFS takes an fs.FS and checks that it represents exactly one valid
// plugin fs tree, with the fs.FS root as the root of the tree.
//
// It does not descend into subdirectories to search for additional plugin.json
// files.
//
// Calling this with a nil thema.Runtime will take advantage of memoization.
// Prefer this approach unless a different thema.Runtime is specifically
// required.
//
// TODO no descent is ok for core plugins, but won't cut it in general
func ParsePluginFS(f fs.FS, rt *thema.Runtime) (*Tree, error) {
	if f == nil {
		return nil, ErrEmptyFS
	}
	lin, err := plugindef.Lineage(rt)
	if err != nil {
		panic(fmt.Sprintf("plugindef lineage is invalid or broken, needs dev attention: %s", err))
	}
	mux := vmux.NewValueMux(lin.TypedSchema(), vmux.NewJSONCodec("plugin.json"))
	ctx := rt.Context()

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

	// Pass the raw bytes into the muxer, get the populated PluginDef type out that we want.
	// TODO stop ignoring second return. (for now, lacunas are a WIP and can't occur until there's >1 schema in the plugindef lineage)
	pmeta, _, err := mux(b)
	if err != nil {
		// TODO more nuanced error handling by class of Thema failure
		return nil, ewrap(err, ErrInvalidRootFile)
	}
	r.meta = *pmeta

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

		// Note that this actually will load any .cue files in the fs.FS root dir in the plugindef.PkgName.
		// That's...maybe good? But not what it says on the tin
		bi, err := load.InstanceWithThema(mfs, "", load.Package(plugindef.PkgName))
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
		if val.Err() != nil {
			return nil, ewrap(fmt.Errorf("models.cue is invalid CUE: %w", val.Err()), ErrInvalidCUE)
		}
		for _, s := range allslots {
			iv := val.LookupPath(cue.ParsePath(s.slot.Name()))
			if iv.Exists() {
				lin, err := bindSlotLineage(iv, s.slot, r.meta, rt)
				if lin != nil {
					r.slotimpls[s.slot.Name()] = lin
				}
				if err != nil {
					return nil, err
				}
			}
		}
	}

	return tree, nil
}

func bindSlotLineage(v cue.Value, s kindsys.SchemaInterface, meta plugindef.PluginDef, rt *thema.Runtime, opts ...thema.BindOption) (thema.Lineage, error) {
	// temporarily keep this around, there are IMMEDIATE plans to refactor
	var required bool
	accept := s.Should(string(meta.Type))
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
	// lin, err := thema.BindLineage(iv, rt, thema.SatisfiesJoinSchema(s.MetaSchema()))
	lin, err := thema.BindLineage(v, rt, opts...)
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
