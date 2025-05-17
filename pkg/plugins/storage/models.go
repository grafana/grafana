package storage

import "fmt"

type ErrPermissionDenied struct {
	Path string
}

func (e ErrPermissionDenied) Error() string {
	return fmt.Sprintf("could not create %q, permission denied, make sure you have write access to plugin dir", e.Path)
}

type ExtractedPluginArchive struct {
	ID           string
	Version      string
	Dependencies []*Dependency
	Path         string
}

type Dependency struct {
	ID string
}
