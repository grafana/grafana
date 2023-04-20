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
	ID      string
	Version string
}

type installedPlugin struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Type         string       `json:"type"`
	Info         pluginInfo   `json:"info"`
	Dependencies dependencies `json:"dependencies"`
}

type dependencies struct {
	GrafanaVersion string             `json:"grafanaVersion"`
	Plugins        []pluginDependency `json:"plugins"`
}

type pluginDependency struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type pluginInfo struct {
	Version string `json:"version"`
	Updated string `json:"updated"`
}
