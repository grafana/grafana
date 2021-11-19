package dtos

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
)

type PluginSetting struct {
	Name          string                 `json:"name"`
	Type          string                 `json:"type"`
	Id            string                 `json:"id"`
	Enabled       bool                   `json:"enabled"`
	Pinned        bool                   `json:"pinned"`
	Module        string                 `json:"module"`
	BaseUrl       string                 `json:"baseUrl"`
	Info          plugins.Info           `json:"info"`
	Includes      []*plugins.Includes    `json:"includes"`
	Dependencies  plugins.Dependencies   `json:"dependencies"`
	JsonData      map[string]interface{} `json:"jsonData"`
	DefaultNavUrl string                 `json:"defaultNavUrl"`

	LatestVersion string                  `json:"latestVersion"`
	HasUpdate     bool                    `json:"hasUpdate"`
	State         plugins.ReleaseState    `json:"state"`
	Signature     plugins.SignatureStatus `json:"signature"`
	SignatureType plugins.SignatureType   `json:"signatureType"`
	SignatureOrg  string                  `json:"signatureOrg"`
}

type PluginListItem struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Type          string       `json:"type"`
	Enabled       bool         `json:"enabled"`
	Pinned        bool         `json:"pinned"`
	HasUpdate     bool         `json:"hasUpdate"`
	LatestVersion string       `json:"latestVersion"`
	Dependencies  []Dependency `json:"dependencies"`

	JSON      PluginJSON    `json:"json"`
	Signature SignatureInfo `json:"signature"`
}

type PluginJSON struct {
	Info          plugins.Info         `json:"info"`
	Dependencies  plugins.Dependencies `json:"dependencies"`
	DefaultNavURL string               `json:"defaultNavUrl"`
	Category      string               `json:"category"`
	State         plugins.ReleaseState `json:"state"`
}

type SignatureInfo struct {
	Status plugins.SignatureStatus `json:"status"`
	Type   plugins.SignatureType   `json:"type"`
	Org    string                  `json:"org"`
}

type Dependency struct {
	Name    string `json:"pluginName"`
	Version string `json:"version"`
}

type PluginList []PluginListItem

func (slice PluginList) Len() int {
	return len(slice)
}

func (slice PluginList) Less(i, j int) bool {
	return slice[i].Name < slice[j].Name
}

func (slice PluginList) Swap(i, j int) {
	slice[i], slice[j] = slice[j], slice[i]
}

type ImportDashboardCommand struct {
	PluginId  string                         `json:"pluginId"`
	Path      string                         `json:"path"`
	Overwrite bool                           `json:"overwrite"`
	Dashboard *simplejson.Json               `json:"dashboard"`
	Inputs    []plugins.ImportDashboardInput `json:"inputs"`
	FolderId  int64                          `json:"folderId"`
	FolderUid string                         `json:"folderUid"`
}

type InstallPluginCommand struct {
	Version string `json:"version"`
}
