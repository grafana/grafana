package pfs

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
	"github.com/yalue/merged_fs"

	"github.com/grafana/grafana/pkg/cuectx"
)

// PackageName is the name of the CUE package that Grafana will load when
// looking for a Grafana plugin's kind declarations.
const PackageName = "grafanaplugin"

// PermittedCUEImports returns the list of import paths that may be used in a
// plugin's grafanaplugin cue package.
var PermittedCUEImports = cuectx.PermittedCUEImports

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

	metadata, err := getPluginMetadata(fsys)
	if err != nil {
		return ParsedPlugin{}, err
	}

	pp := ParsedPlugin{
		ComposableKinds: make(map[string]kindsys.Composable),
		Properties:      metadata,
	}

	if cuefiles, err := fs.Glob(fsys, "*.cue"); err != nil {
		return ParsedPlugin{}, fmt.Errorf("error globbing for cue files in fsys: %w", err)
	} else if len(cuefiles) == 0 {
		return pp, nil
	}

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

	gpi := rt.Context().BuildInstance(bi)
	if gpi.Err() != nil {
		return ParsedPlugin{}, errors.Wrap(errors.Promote(ErrInvalidGrafanaPluginInstance, pp.Properties.Id), gpi.Err())
	}

	for _, si := range allsi {
		iv := gpi.LookupPath(cue.MakePath(cue.Str("composableKinds"), cue.Str(si.Name())))
		if !iv.Exists() {
			continue
		}

		iv = iv.FillPath(cue.MakePath(cue.Str("schemaInterface")), si.Name())
		iv = iv.FillPath(cue.MakePath(cue.Str("name")), derivePascalName(pp.Properties.Id, pp.Properties.Name)+si.Name())
		lineageNamePath := iv.LookupPath(cue.MakePath(cue.Str("lineage"), cue.Str("name")))
		if !lineageNamePath.Exists() {
			iv = iv.FillPath(cue.MakePath(cue.Str("lineage"), cue.Str("name")), derivePascalName(pp.Properties.Id, pp.Properties.Name)+si.Name())
		}

		validSchema := iv.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))
		if !validSchema.Exists() {
			return ParsedPlugin{}, errors.Wrap(errors.Promote(ErrInvalidGrafanaPluginInstance, pp.Properties.Id), validSchema.Err())
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

	return pp, nil
}

// LoadComposableKindDef loads and validates a composable kind definition.
// On success, it returns a [Def] which contains the entire contents of the kind definition.
//
// defpath is the path to the directory containing the composable kind definition,
// relative to the root of the caller's repository.
//
// NOTE This function will be deprecated in favor of a more generic loader when kind
// providers will be implemented.
func LoadComposableKindDef(fsys fs.FS, rt *thema.Runtime, defpath string) (kindsys.Def[kindsys.ComposableProperties], error) {
	pp := ParsedPlugin{
		ComposableKinds: make(map[string]kindsys.Composable),
		Properties: Metadata{
			Id: defpath,
		},
	}

	fsys, err := ensureCueMod(fsys, pp.Properties)
	if err != nil {
		return kindsys.Def[kindsys.ComposableProperties]{}, fmt.Errorf("%s has invalid cue.mod: %w", pp.Properties.Id, err)
	}

	bi, err := cuectx.LoadInstanceWithGrafana(fsys, "", load.Package(PackageName))
	if err != nil {
		return kindsys.Def[kindsys.ComposableProperties]{}, err
	}

	ctx := rt.Context()
	v := ctx.BuildInstance(bi)
	if v.Err() != nil {
		return kindsys.Def[kindsys.ComposableProperties]{}, fmt.Errorf("%s not a valid CUE instance: %w", defpath, v.Err())
	}

	props, err := kindsys.ToKindProps[kindsys.ComposableProperties](v)
	if err != nil {
		return kindsys.Def[kindsys.ComposableProperties]{}, err
	}

	return kindsys.Def[kindsys.ComposableProperties]{
		V:          v,
		Properties: props,
	}, nil
}

func ensureCueMod(fsys fs.FS, metadata Metadata) (fs.FS, error) {
	if modf, err := fs.ReadFile(fsys, "cue.mod/module.cue"); err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}
		return merged_fs.NewMergedFS(fsys, fstest.MapFS{
			"cue.mod/module.cue": &fstest.MapFile{Data: []byte(fmt.Sprintf(`module: "grafana.com/grafana/plugins/%s"`, metadata.Id))},
		}), nil
	} else if _, err := cuecontext.New().CompileBytes(modf).LookupPath(cue.MakePath(cue.Str("module"))).String(); err != nil {
		return nil, fmt.Errorf("error reading cue module name: %w", err)
	}

	return fsys, nil
}

func getPluginMetadata(fsys fs.FS) (Metadata, error) {
	b, err := fs.ReadFile(fsys, "plugin.json")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Metadata{}, ErrNoRootFile
		}
		return Metadata{}, fmt.Errorf("error reading plugin.json: %w", err)
	}

	var metadata PluginDef
	if err := json.Unmarshal(b, &metadata); err != nil {
		return Metadata{}, fmt.Errorf("error unmarshalling plugin.json: %s", err)
	}

	if err := metadata.Validate(); err != nil {
		return Metadata{}, err
	}

	return Metadata{
		Id:      metadata.Id,
		Name:    metadata.Name,
		Backend: metadata.Backend,
		Version: metadata.Info.Version,
	}, nil
}

func derivePascalName(id string, name string) string {
	sani := func(s string) string {
		ret := strings.Title(strings.Map(func(r rune) rune {
			switch {
			case r >= 'a' && r <= 'z':
				return r
			case r >= 'A' && r <= 'Z':
				return r
			default:
				return -1
			}
		}, strings.Title(strings.Map(func(r rune) rune {
			switch r {
			case '-', '_':
				return ' '
			default:
				return r
			}
		}, s))))
		if len(ret) > 63 {
			return ret[:63]
		}
		return ret
	}

	fromname := sani(name)
	if len(fromname) != 0 {
		return fromname
	}
	return sani(strings.Split(id, "-")[1])
}
