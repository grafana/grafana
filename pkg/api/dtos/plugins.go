package dtos

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
	Name          string                  `json:"name"`
	Type          string                  `json:"type"`
	Id            string                  `json:"id"`
	Enabled       bool                    `json:"enabled"`
	Pinned        bool                    `json:"pinned"`
	Info          plugins.Info            `json:"info"`
	Dependencies  plugins.Dependencies    `json:"dependencies"`
	LatestVersion string                  `json:"latestVersion"`
	HasUpdate     bool                    `json:"hasUpdate"`
	DefaultNavUrl string                  `json:"defaultNavUrl"`
	Category      string                  `json:"category"`
	State         plugins.ReleaseState    `json:"state"`
	Signature     plugins.SignatureStatus `json:"signature"`
	SignatureType plugins.SignatureType   `json:"signatureType"`
	SignatureOrg  string                  `json:"signatureOrg"`
	AccessControl accesscontrol.Metadata  `json:"accessControl,omitempty"`
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

type InstallPluginCommand struct {
	Version string `json:"version"`
}
