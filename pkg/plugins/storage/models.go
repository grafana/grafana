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

type InstalledPlugin struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Type         string       `json:"type"`
	Info         PluginInfo   `json:"info"`
	Dependencies Dependencies `json:"dependencies"`
}

type Dependencies struct {
	GrafanaVersion string             `json:"grafanaVersion"`
	Plugins        []PluginDependency `json:"plugins"`
}

type PluginDependency struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type PluginInfo struct {
	Version string `json:"version"`
	Updated string `json:"updated"`
}
