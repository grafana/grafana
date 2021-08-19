package load

import (
	"fmt"
	"io"
	"io/fs"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana"
)

var rt = &cue.Runtime{}

// Families can have variants, where more typing information narrows the
// possible values for certain keys in schemas. These are a meta-property
// of the schema, effectively encoded in these loaders.
//
// We can generally define three variants:
//  - "Base": strictly core schema files, no plugins. (go:embed-able)
//  - "Dist": "Base" + plugins that ship with vanilla Grafana (go:embed-able)
//  - "Instance": "Dist" + the non-core plugins available in an actual, running Grafana

// BaseLoadPaths contains the configuration for loading a DistDashboard
type BaseLoadPaths struct {
	// BaseCueFS should be rooted at a directory containing the filesystem layout
	// expected to exist at github.com/grafana/grafana/cue.
	BaseCueFS fs.FS

	// DistPluginCueFS should point to some fs path (TBD) under which all core
	// plugins live.
	DistPluginCueFS fs.FS

	// InstanceCueFS should point to a root dir in which non-core plugins live.
	// Normal case will be that this only happens when an actual Grafana
	// instance is making the call, and has a plugin dir to offer - though
	// external tools could always create their own dirs shaped like a Grafana
	// plugin dir, and point to those.
	InstanceCueFS fs.FS
}

func GetDefaultLoadPaths() BaseLoadPaths {
	return BaseLoadPaths{
		BaseCueFS:       grafana.CoreSchema,
		DistPluginCueFS: grafana.PluginSchema,
	}
}

// toOverlay converts all .cue files in the fs.FS into Source entries in an
// overlay map, as expected by load.Config.
//
// Each entry is placed in the map with the provided prefix - which must be an
// absolute path - ahead of the actual path of the added file within the fs.FS.
//
// The function writes into the provided overlay map, to facilitate the
// construction of a single overlay map from multiple fs.FS.
//
// All files reachable by walking the provided fs.FS are added to the overlay
// map, on the premise that control over the FS is sufficient to allow any
// desired filtering.
func toOverlay(prefix string, vfs fs.FS, overlay map[string]load.Source) error {
	if !filepath.IsAbs(prefix) {
		return fmt.Errorf("must provide absolute path prefix when generating cue overlay, got %q", prefix)
	}
	err := fs.WalkDir(vfs, ".", (func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		f, err := vfs.Open(path)
		if err != nil {
			return err
		}

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		overlay[filepath.Join(prefix, path)] = load.FromBytes(b)
		return nil
	}))

	if err != nil {
		return err
	}

	return nil
}
