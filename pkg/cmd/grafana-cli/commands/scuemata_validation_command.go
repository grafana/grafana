package commands

import (
	gerrors "errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue/errors"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/schema/load"
)

var paths = load.GetDefaultLoadPaths()

func (cmd Command) validateScuemata(c utils.CommandLine) error {
	root := c.String("grafana-root")
	if root == "" {
		return gerrors.New("must provide path to the root of a Grafana repository checkout")
	}

	// Construct a MapFS with the same set of files as those embedded in
	// /embed.go, but sourced straight through from disk instead of relying on
	// what's compiled.  Not the greatest, because we're duplicating
	// filesystem-loading logic with what's in /embed.go.

	populate := func(in fs.FS, join string) (fs.FS, error) {
		out := make(fstest.MapFS)
		err := fs.WalkDir(in, ".", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() {
				return nil
			}
			// Ignore gosec warning G304. The input set here is necessarily
			// constrained to files specified in embed.go
			// nolint:gosec
			b, err := os.Open(filepath.Join(root, join, path))
			if err != nil {
				return err
			}
			byt, err := io.ReadAll(b)
			if err != nil {
				return err
			}

			out[path] = &fstest.MapFile{Data: byt}
			return nil
		})
		return out, err
	}

	var fspaths load.BaseLoadPaths
	var err error

	fspaths.BaseCueFS, err = populate(paths.BaseCueFS, "")
	if err != nil {
		return err
	}
	fspaths.DistPluginCueFS, err = populate(paths.DistPluginCueFS, "public/app/plugins")
	if err != nil {
		return err
	}

	if err := validateScuemata(fspaths, load.DistDashboardFamily); err != nil {
		return schema.WrapCUEError(err)
	}

	return nil
}

func (cmd Command) validateResources(c utils.CommandLine) error {
	filename := c.String("dashboard")
	baseonly := c.Bool("base-only")
	if filename == "" {
		return gerrors.New("must specify dashboard to validate with --dashboard")
	}
	b, err := os.Open(filepath.Clean(filename))
	res := schema.Resource{Value: b, Name: filename}
	if err != nil {
		return err
	}

	var sch schema.VersionedCueSchema
	if baseonly {
		sch, err = load.BaseDashboardFamily(paths)
	} else {
		sch, err = load.DistDashboardFamily(paths)
	}
	if err != nil {
		return fmt.Errorf("error while loading dashboard scuemata, err: %w", err)
	}

	err = sch.Validate(res)
	if err != nil {
		return gerrors.New(errors.Details(err, nil))
	}
	return nil
}

func validateScuemata(p load.BaseLoadPaths, loader func(p load.BaseLoadPaths) (schema.VersionedCueSchema, error)) error {
	dash, err := loader(p)
	if err != nil {
		return fmt.Errorf("error while loading dashboard scuemata, err: %w", err)
	}

	// Check that a CUE value exists.
	cueValue := dash.CUE()
	if !cueValue.Exists() {
		return fmt.Errorf("cue value for schema does not exist")
	}

	// Check CUE validity.
	if err := cueValue.Validate(); err != nil {
		return fmt.Errorf("all schema should be valid with respect to basic CUE rules, %w", err)
	}

	return nil
}
