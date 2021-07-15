package commands

import (
	gerrors "errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/schema/load"
)

var paths = load.GetDefaultLoadPaths()

func (cmd Command) validateScuemataBasics(c utils.CommandLine) error {
	if err := validateScuemata(paths, load.BaseDashboardFamily); err != nil {
		return err
	}

	if err := validateScuemata(paths, load.DistDashboardFamily); err != nil {
		return err
	}

	return nil
}

func (cmd Command) validateResources(c utils.CommandLine) error {
	filename := c.String("dashboard")
	if filename == "" {
		return gerrors.New("must specify dashboard to validate with --dashboard")
	}
	b, err := os.Open(filepath.Clean(filename))
	res := schema.Resource{Value: b, Name: filename}
	if err != nil {
		return err
	}

	if err := validateResources(res, paths, load.BaseDashboardFamily); err != nil {
		return err
	}

	if err := validateResources(res, paths, load.DistDashboardFamily); err != nil {
		return err
	}

	return nil
}

func validateResources(res schema.Resource, p load.BaseLoadPaths, loader func(p load.BaseLoadPaths) (schema.VersionedCueSchema, error)) error {
	dash, err := loader(p)
	if err != nil {
		return fmt.Errorf("error while loading dashboard scuemata, err: %w", err)
	}

	return dash.Validate(res)
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
