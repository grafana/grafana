package pfs

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/codegen"
)

// PackageName is the name of the CUE package that Grafana will load when
// looking for a Grafana plugin's kind declarations.
const PackageName = "grafanaplugin"

var schemaInterface = map[string]SchemaInterface{
	"DataQuery": {
		Name:    "DataQuery",
		IsGroup: false,
	},
	"PanelCfg": {
		Name:    "PanelCfg",
		IsGroup: true,
	},
}

// PermittedCUEImports returns the list of import paths that may be used in a
// plugin's grafanaplugin cue package.
var PermittedCUEImports = codegen.PermittedCUEImports

func importAllowed(path string) bool {
	for _, p := range PermittedCUEImports() {
		if p == path {
			return true
		}
	}
	return false
}

var allowedImportsStr string

func init() {
	all := make([]string, 0, len(PermittedCUEImports()))
	for _, im := range PermittedCUEImports() {
		all = append(all, fmt.Sprintf("\t%s", im))
	}
	allowedImportsStr = strings.Join(all, "\n")
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
// [GrafanaPlugin]: https://github.com/grafana/grafana/blob/main/pkg/plugins/pfs/grafanaplugin.cue
func ParsePluginFS(ctx *cue.Context, fsys fs.FS, dir string) (ParsedPlugin, error) {
	if fsys == nil {
		return ParsedPlugin{}, ErrEmptyFS
	}

	cuefiles, err := fs.Glob(fsys, "*.cue")
	if err != nil {
		return ParsedPlugin{}, fmt.Errorf("error globbing for cue files in fsys: %w", err)
	} else if len(cuefiles) == 0 {
		return ParsedPlugin{}, nil
	}

	metadata, err := getPluginMetadata(fsys)
	if err != nil {
		return ParsedPlugin{}, err
	}

	pp := ParsedPlugin{
		Properties: metadata,
	}

	if err != nil {
		return ParsedPlugin{}, err
	}

	bi := load.Instances(cuefiles, &load.Config{
		Package: PackageName,
		Dir:     dir,
	})[0]
	if bi.Err != nil {
		return ParsedPlugin{}, bi.Err
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

	gpi := ctx.BuildInstance(bi)
	if gpi.Err() != nil {
		return ParsedPlugin{}, errors.Wrap(errors.Promote(ErrInvalidGrafanaPluginInstance, pp.Properties.Id), gpi.Err())
	}

	for name, si := range schemaInterface {
		iv := gpi.LookupPath(cue.MakePath(cue.Str("composableKinds"), cue.Str(name)))
		if !iv.Exists() {
			continue
		}

		iv = iv.FillPath(cue.MakePath(cue.Str("schemaInterface")), name)
		iv = iv.FillPath(cue.MakePath(cue.Str("name")), derivePascalName(pp.Properties.Id, pp.Properties.Name)+name)
		lineageNamePath := iv.LookupPath(cue.MakePath(cue.Str("lineage"), cue.Str("name")))
		if !lineageNamePath.Exists() {
			iv = iv.FillPath(cue.MakePath(cue.Str("lineage"), cue.Str("name")), derivePascalName(pp.Properties.Id, pp.Properties.Name)+name)
		}

		validSchema := iv.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))
		if !validSchema.Exists() {
			return ParsedPlugin{}, errors.Wrap(errors.Promote(ErrInvalidGrafanaPluginInstance, pp.Properties.Id), validSchema.Err())
		}
		pp.Variant = si
		pp.CueFile = iv
	}

	return pp, nil
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
