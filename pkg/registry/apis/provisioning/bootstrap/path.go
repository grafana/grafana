package bootstrap

import (
	"errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// ErrRootPath is returned for a path that cleans to the empty prefix, which
// [safepath.InDir] matches against every path.
var ErrRootPath = errors.New("path resolves to the filesystem root")

// ValidatePath rejects a bootstrap path admission would reject as a local repository's path,
// plus the filesystem root. The setting grants reads before any repository exists.
func ValidatePath(path string) error {
	if err := safepath.IsSafe(path); err != nil {
		return err
	}
	if safepath.Clean(path) == "" {
		return ErrRootPath
	}
	return nil
}
