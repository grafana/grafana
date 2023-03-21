package cuectx

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
	"github.com/yalue/merged_fs"

	"github.com/grafana/grafana"
)

// LoadGrafanaInstancesWithThema loads CUE files containing a lineage
// representing some Grafana core model schema. It is expected to be used when
// implementing a thema.LineageFactory.
//
// This function primarily juggles paths to make CUE's loader happy. Provide the
// path from the grafana root to the directory containing the lineage.cue. The
// lineage.cue file must be the sole contents of the provided fs.FS.
//
// More details on underlying behavior can be found in the docs for github.com/grafana/thema/load.InstanceWithThema.
//
// TODO this approach is complicated and confusing, refactor to something understandable
func LoadGrafanaInstancesWithThema(path string, cueFS fs.FS, rt *thema.Runtime, opts ...thema.BindOption) (thema.Lineage, error) {
	prefix := filepath.FromSlash(path)
	fs, err := prefixWithGrafanaCUE(prefix, cueFS)
	if err != nil {
		return nil, err
	}
	inst, err := load.InstanceWithThema(fs, prefix)

	// Need to trick loading by creating the embedded file and
	// making it look like a module in the root dir.
	if err != nil {
		return nil, err
	}

	val := rt.Context().BuildInstance(inst)

	lin, err := thema.BindLineage(val, rt, opts...)
	if err != nil {
		return nil, err
	}

	return lin, nil
}

// prefixWithGrafanaCUE constructs an fs.FS that merges the provided fs.FS with
// the embedded FS containing Grafana's core CUE files, [grafana.CueSchemaFS].
// The provided prefix should be the relative path from the grafana repository
// root to the directory root of the provided inputfs.
//
// The returned fs.FS is suitable for passing to a CUE loader, such as [load.InstanceWithThema].
func prefixWithGrafanaCUE(prefix string, inputfs fs.FS) (fs.FS, error) {
	m, err := prefixFS(prefix, inputfs)
	if err != nil {
		return nil, err
	}
	return merged_fs.NewMergedFS(m, grafana.CueSchemaFS), nil
}

// TODO such a waste, replace with stateless impl that just transforms paths on the fly
func prefixFS(prefix string, fsys fs.FS) (fs.FS, error) {
	m := make(fstest.MapFS)

	prefix = filepath.FromSlash(prefix)
	err := fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		b, err := fs.ReadFile(fsys, filepath.ToSlash(path))
		if err != nil {
			return err
		}
		// fstest can recognize only forward slashes.
		m[filepath.ToSlash(filepath.Join(prefix, path))] = &fstest.MapFile{Data: b}
		return nil
	})
	return m, err
}

// LoadGrafanaInstance wraps [load.InstanceWithThema] to load a
// [*build.Instance] corresponding to a particular path within the
// github.com/grafana/grafana CUE module.
//
// This allows resolution of imports within the grafana or thema CUE modules to
// work correctly and consistently by relying on the embedded FS at
// [grafana.CueSchemaFS] and [thema.CueFS].
//
// relpath should be a relative path path within [grafana.CueSchemaFS] to be
// loaded. Optionally, the caller may provide an additional fs.FS via the
// overlay parameter, which will be merged with [grafana.CueSchemaFS] at
// relpath, and loaded.
//
// pkg, if non-empty, is set as the value of
// ["cuelang.org/go/cue/load".Config.Package]. If the CUE package to be loaded
// is the same as the parent directory name, it should be omitted.
//
// NOTE this function will be deprecated in favor of a more generic loader
func LoadGrafanaInstance(relpath string, pkg string, overlay fs.FS) (*build.Instance, error) {
	// notes about how this crap needs to work
	//
	// Within grafana/grafana, need:
	// - pass in an fs.FS that, in its root, contains the .cue files to load
	// - has no cue.mod
	// - gets prefixed with the appropriate path within grafana/grafana
	// - and merged with all the other .cue files from grafana/grafana
	// notes about how this crap needs to work
	//
	// Need a prefixing instance loader that:
	//  - can take multiple fs.FS, each one representing a CUE module (nesting?)
	//  - reconcile at most one of the provided fs with cwd
	//    - behavior must differ depending on whether cwd is in a cue module
	//    - behavior should(?) be controllable depending on
	relpath = filepath.ToSlash(relpath)

	var f fs.FS = grafana.CueSchemaFS
	// merge the kindsys filesystem with ours for the kind categories
	f = merged_fs.NewMergedFS(kindsys.CueSchemaFS, f)

	var err error
	if overlay != nil {
		f, err = prefixWithGrafanaCUE(relpath, overlay)
		if err != nil {
			return nil, err
		}
	}

	if pkg != "" {
		return load.InstanceWithThema(f, relpath, load.Package(pkg))
	}
	return load.InstanceWithThema(f, relpath)
}

// BuildGrafanaInstance wraps [LoadGrafanaInstance], additionally building
// the returned [*build.Instance] into a [cue.Value].
//
// An error is returned if:
//   - The underlying call to [LoadGrafanaInstance] returns an error
//   - The built [cue.Value] has an error ([cue.Value.Err] returns non-nil)
//
// NOTE this function will be deprecated in favor of a more generic builder
func BuildGrafanaInstance(ctx *cue.Context, relpath string, pkg string, overlay fs.FS) (cue.Value, error) {
	bi, err := LoadGrafanaInstance(relpath, pkg, overlay)
	if err != nil {
		return cue.Value{}, err
	}

	if ctx == nil {
		ctx = GrafanaCUEContext()
	}
	v := ctx.BuildInstance(bi)
	if v.Err() != nil {
		return v, fmt.Errorf("%s not a valid CUE instance: %w", relpath, v.Err())
	}
	return v, nil
}

// LoadInstanceWithGrafana loads a [*build.Instance] from .cue files
// in the provided modFS as ["cuelang.org/go/cue/load".Instances], but
// fulfilling any imports of CUE packages under:
//
//   - github.com/grafana/grafana
//   - github.com/grafana/thema
//
// This function is modeled after [load.InstanceWithThema]. It has the same
// signature and expectations for the modFS.
//
// Attempting to use this func to load files within the
// github.com/grafana/grafana CUE module will result in an error. Use
// [LoadGrafanaInstance] instead.
//
// NOTE This function will be deprecated in favor of a more generic loader
func LoadInstanceWithGrafana(fsys fs.FS, dir string, opts ...load.Option) (*build.Instance, error) {
	if modf, err := fs.ReadFile(fsys, "cue.mod/module.cue"); err != nil {
		// delegate error handling
		return load.InstanceWithThema(fsys, dir, opts...)
	} else if modname, err := cuecontext.New().CompileBytes(modf).LookupPath(cue.MakePath(cue.Str("module"))).String(); err != nil {
		// delegate error handling
		return load.InstanceWithThema(fsys, dir, opts...)
	} else if modname == "github.com/grafana/grafana" {
		return nil, fmt.Errorf("use cuectx.LoadGrafanaInstance to load .cue files within github.com/grafana/grafana CUE module")
	}

	// TODO wasteful, doing this every time - make that stateless prefixfs!
	depFS, err := prefixFS("cue.mod/pkg/github.com/grafana/grafana", grafana.CueSchemaFS)
	if err != nil {
		panic(err)
	}
	// TODO wasteful, doing this every time - make that stateless prefixfs!
	kindsysFS, err := prefixFS("cue.mod/pkg/github.com/grafana/kindsys", kindsys.CueSchemaFS)
	if err != nil {
		panic(err)
	}

	allTheFs := merged_fs.MergeMultiple(kindsysFS, depFS, fsys)

	// FIXME remove grafana from cue.mod/pkg if it exists, otherwise external thing can inject files to be loaded
	return load.InstanceWithThema(allTheFs, dir, opts...)
}

// LoadCoreKindDef loads and validates a core kind definition of the kind
// category indicated by the type parameter. On success, it returns a [Def]
// which contains the entire contents of the kind definition.
//
// defpath is the path to the directory containing the core kind definition,
// relative to the root of the caller's repository. For example, under
// dashboards are in "kinds/dashboard".
func LoadCoreKindDef(defpath string, ctx *cue.Context, overlay fs.FS) (kindsys.Def[kindsys.CoreProperties], error) {
	vk, err := BuildGrafanaInstance(ctx, defpath, "kind", overlay)
	if err != nil {
		return kindsys.Def[kindsys.CoreProperties]{}, err
	}

	props, err := kindsys.ToKindProps[kindsys.CoreProperties](vk)
	if err != nil {
		return kindsys.Def[kindsys.CoreProperties]{}, err
	}

	return kindsys.Def[kindsys.CoreProperties]{
		V:          vk,
		Properties: props,
	}, nil
}
