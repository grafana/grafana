package pfs

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"github.com/grafana/kindsys"
	kindcheck "github.com/grafana/kindsys/validation"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
	"github.com/grafana/thema/vmux"
	"github.com/yalue/merged_fs"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
)

// PackageName is the name of the CUE package that Grafana will load when
// looking for a Grafana plugin's kind declarations.
const PackageName = "grafanaplugin"

var onceGP sync.Once
var defaultGP cue.Value

func doLoadGP(ctx *cue.Context) cue.Value {
	v, err := cuectx.BuildGrafanaInstance(ctx, filepath.Join("pkg", "plugins", "pfs"), "pfs", nil)
	if err != nil {
		// should be unreachable
		panic(err)
	}
	return v.LookupPath(cue.MakePath(cue.Str("GrafanaPlugin")))
}

func loadGP(ctx *cue.Context) cue.Value {
	if ctx == nil || ctx == cuectx.GrafanaCUEContext() {
		onceGP.Do(func() {
			defaultGP = doLoadGP(ctx)
		})
		return defaultGP
	}
	return doLoadGP(ctx)
}

// PermittedCUEImports returns the list of import paths that may be used in a
// plugin's grafanaplugin cue package.
//
// TODO probably move this into kindsys
func PermittedCUEImports() []string {
	return []string{
		"github.com/grafana/thema",
		"github.com/grafana/kindsys",
		"github.com/grafana/grafana/pkg/plugins/pfs",
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

var allsi []kindsys.SchemaInterface

func init() {
	all := make([]string, 0, len(PermittedCUEImports()))
	for _, im := range PermittedCUEImports() {
		all = append(all, fmt.Sprintf("\t%s", im))
	}
	allowedImportsStr = strings.Join(all, "\n")

	for _, s := range kindsys.SchemaInterfaces(nil) {
		allsi = append(allsi, s)
	}

	sort.Slice(allsi, func(i, j int) bool {
		return allsi[i].Name() < allsi[j].Name()
	})
}

// ParsePluginFS takes a virtual filesystem and checks that it contains a valid
// set of files that statically define a Grafana plugin.
//
// The fsys must contain a plugin.json at the root, which must be valid
// according to the [plugindef] schema. If any .cue files exist in the
// grafanaplugin package, these will also be loaded and validated according to
// the [GrafanaPlugin] specification. This includes the validation of any custom
// or composable kinds and their contained lineages, via [thema.BindLineage].
//
// This function parses exactly one plugin. It does not descend into
// subdirectories to search for additional plugin.json or .cue files.
//
// Calling this with a nil [thema.Runtime] (the singleton returned from
// [cuectx.GrafanaThemaRuntime] is used) will memoize certain CUE operations.
// Prefer passing nil unless a different thema.Runtime is specifically required.
//
// [GrafanaPlugin]: https://github.com/grafana/grafana/blob/main/pkg/plugins/pfs/grafanaplugin.cue
func ParsePluginFS(fsys fs.FS, rt *thema.Runtime) (ParsedPlugin, error) {
	if fsys == nil {
		return ParsedPlugin{}, ErrEmptyFS
	}
	if rt == nil {
		rt = cuectx.GrafanaThemaRuntime()
	}

	lin, err := plugindef.Lineage(rt)
	if err != nil {
		panic(fmt.Sprintf("plugindef lineage is invalid or broken, needs dev attention: %s", err))
	}
	ctx := rt.Context()

	b, err := fs.ReadFile(fsys, "plugin.json")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return ParsedPlugin{}, ErrNoRootFile
		}
		return ParsedPlugin{}, fmt.Errorf("error reading plugin.json: %w", err)
	}

	pp := ParsedPlugin{
		ComposableKinds: make(map[string]kindsys.Composable),
		// CustomKinds:     make(map[string]kindsys.Custom),
	}

	// Pass the raw bytes into the muxer, get the populated PluginDef type out that we want.
	// TODO stop ignoring second return. (for now, lacunas are a WIP and can't occur until there's >1 schema in the plugindef lineage)
	pinst, _, err := vmux.NewTypedMux(lin.TypedSchema(), vmux.NewJSONCodec("plugin.json"))(b)
	if err != nil {
		return ParsedPlugin{}, errors.Wrap(errors.Promote(err, ""), ErrInvalidRootFile)
	}
	pp.Properties = *(pinst.ValueP())
	// FIXME remove this once it's being correctly populated coming out of lineage
	if pp.Properties.PascalName == "" {
		pp.Properties.PascalName = plugindef.DerivePascalName(pp.Properties)
	}

	if cuefiles, err := fs.Glob(fsys, "*.cue"); err != nil {
		return ParsedPlugin{}, fmt.Errorf("error globbing for cue files in fsys: %w", err)
	} else if len(cuefiles) == 0 {
		return pp, nil
	}

	gpv := loadGP(rt.Context())

	fsys, err = ensureCueMod(fsys, pp.Properties)
	if err != nil {
		return ParsedPlugin{}, fmt.Errorf("%s has invalid cue.mod: %w", pp.Properties.Id, err)
	}

	bi, err := cuectx.LoadInstanceWithGrafana(fsys, "", load.Package(PackageName))
	if err != nil || bi.Err != nil {
		if err == nil {
			err = bi.Err
		}
		return ParsedPlugin{}, errors.Wrap(errors.Newf(token.NoPos, "%s did not load", pp.Properties.Id), err)
	}

	f, _ := parser.ParseFile("plugin.json", fmt.Sprintf(`{
		"id": %q,
		"pascalName": %q
	}`, pp.Properties.Id, pp.Properties.PascalName))

	for _, f := range bi.Files {
		for _, im := range f.Imports {
			ip := strings.Trim(im.Path.Value, "\"")
			if !importAllowed(ip) {
				return ParsedPlugin{}, errors.Wrap(errors.Newf(im.Pos(),
					"import of %q in grafanaplugin cue package not allowed, plugins may only import from:\n%s\n", ip, allowedImportsStr),
					ErrDisallowedCUEImport)
			}
			pp.CUEImports = append(pp.CUEImports, im)
		}
	}

	// build.Instance.Files has a comment indicating the CUE authors want to change
	// its behavior. This is a tripwire to tell us if/when they do that - otherwise, if
	// the change they make ends up making bi.Files empty, the above loop will silently
	// become a no-op, and we'd lose enforcement of import restrictions in plugins without
	// realizing it.
	if len(bi.Files) != len(bi.BuildFiles) {
		panic("Refactor required - upstream CUE implementation changed, bi.Files is no longer populated")
	}

	// Inject the JSON directly into the build so it gets loaded together
	bi.BuildFiles = append(bi.BuildFiles, &build.File{
		Filename: "plugin.json",
		Encoding: build.JSON,
		Form:     build.Data,
		Source:   b,
	})
	bi.Files = append(bi.Files, f)

	gpi := ctx.BuildInstance(bi).Unify(gpv)
	if gpi.Err() != nil {
		return ParsedPlugin{}, errors.Wrap(errors.Promote(ErrInvalidGrafanaPluginInstance, pp.Properties.Id), gpi.Err())
	}

	for _, si := range allsi {
		iv := gpi.LookupPath(cue.MakePath(cue.Str("composableKinds"), cue.Str(si.Name())))
		if !iv.Exists() {
			continue
		}

		if err := kindcheck.EnsureNoExportedKindName(iv); err != nil {
			return ParsedPlugin{}, err
		}

		props, err := kindsys.ToKindProps[kindsys.ComposableProperties](iv)
		if err != nil {
			return ParsedPlugin{}, err
		}

		compo, err := kindsys.BindComposable(rt, kindsys.Def[kindsys.ComposableProperties]{
			Properties: props,
			V:          iv,
		})
		if err != nil {
			return ParsedPlugin{}, err
		}
		pp.ComposableKinds[si.Name()] = compo
	}

	// TODO custom kinds
	return pp, nil
}

func ensureCueMod(fsys fs.FS, pdef plugindef.PluginDef) (fs.FS, error) {
	if modf, err := fs.ReadFile(fsys, "cue.mod/module.cue"); err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}
		return merged_fs.NewMergedFS(fsys, fstest.MapFS{
			"cue.mod/module.cue": &fstest.MapFile{Data: []byte(fmt.Sprintf(`module: "grafana.com/grafana/plugins/%s"`, pdef.Id))},
		}), nil
	} else if _, err := cuecontext.New().CompileBytes(modf).LookupPath(cue.MakePath(cue.Str("module"))).String(); err != nil {
		return nil, fmt.Errorf("error reading cue module name: %w", err)
	}

	return fsys, nil
}
