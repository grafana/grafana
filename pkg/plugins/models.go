package plugins

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins/manifest"
	"github.com/grafana/grafana/pkg/plugins/signature"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	TypeDashboard = "dashboard"
)

var (
	ErrInstallCorePlugin   = errors.New("cannot install a Core plugin")
	ErrUninstallCorePlugin = errors.New("cannot uninstall a Core plugin")
	ErrPluginNotInstalled  = errors.New("plugin is not installed")
)

type NotFoundError struct {
	PluginID string
}

func (e NotFoundError) Error() string {
	return fmt.Sprintf("plugin with ID '%s' not found", e.PluginID)
}

type DuplicateError struct {
	PluginID          string
	ExistingPluginDir string
}

func (e DuplicateError) Error() string {
	return fmt.Sprintf("plugin with ID '%s' already exists in '%s'", e.PluginID, e.ExistingPluginDir)
}

func (e DuplicateError) Is(err error) bool {
	// nolint:errorlint
	_, ok := err.(DuplicateError)
	return ok
}

type Dependencies struct {
	GrafanaDependency string       `json:"grafanaDependency"`
	GrafanaVersion    string       `json:"grafanaVersion"`
	Plugins           []Dependency `json:"plugins"`
}

type Includes struct {
	Name       string       `json:"name"`
	Path       string       `json:"path"`
	Type       string       `json:"type"`
	Component  string       `json:"component"`
	Role       org.RoleType `json:"role"`
	AddToNav   bool         `json:"addToNav"`
	DefaultNav bool         `json:"defaultNav"`
	Slug       string       `json:"slug"`
	Icon       string       `json:"icon"`
	UID        string       `json:"uid"`

	ID string `json:"-"`
}

func (e Includes) DashboardURLPath() string {
	if e.Type != "dashboard" || len(e.UID) == 0 {
		return ""
	}
	return "/d/" + e.UID
}

type Dependency struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type BuildInfo struct {
	Time   int64  `json:"time,omitempty"`
	Repo   string `json:"repo,omitempty"`
	Branch string `json:"branch,omitempty"`
	Hash   string `json:"hash,omitempty"`
}

type Info struct {
	Author      InfoLink      `json:"author"`
	Description string        `json:"description"`
	Links       []InfoLink    `json:"links"`
	Logos       Logos         `json:"logos"`
	Build       BuildInfo     `json:"build"`
	Screenshots []Screenshots `json:"screenshots"`
	Version     string        `json:"version"`
	Updated     string        `json:"updated"`
}

type InfoLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Logos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

type Screenshots struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type StaticRoute struct {
	PluginID  string
	Directory string
}

type ReleaseState string

const (
	AlphaRelease ReleaseState = "alpha"
)

type PluginFiles map[string]struct{}

type Signature struct {
	Status     signature.Status
	Type       manifest.SignatureType
	SigningOrg string
	Files      PluginFiles
}

type PluginMetaDTO struct {
	JSONData

	Signature signature.Status `json:"signature"`

	Module  string `json:"module"`
	BaseURL string `json:"baseUrl"`
}

type DataSourceDTO struct {
	ID         int64                  `json:"id,omitempty"`
	UID        string                 `json:"uid,omitempty"`
	Type       string                 `json:"type"`
	Name       string                 `json:"name"`
	PluginMeta *PluginMetaDTO         `json:"meta"`
	URL        string                 `json:"url,omitempty"`
	IsDefault  bool                   `json:"isDefault"`
	Access     string                 `json:"access,omitempty"`
	Preload    bool                   `json:"preload"`
	Module     string                 `json:"module,omitempty"`
	JSONData   map[string]interface{} `json:"jsonData"`
	ReadOnly   bool                   `json:"readOnly"`

	BasicAuth       string `json:"basicAuth,omitempty"`
	WithCredentials bool   `json:"withCredentials,omitempty"`

	// InfluxDB
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`

	// InfluxDB + Elasticsearch
	Database string `json:"database,omitempty"`

	// Prometheus
	DirectURL string `json:"directUrl,omitempty"`
}

type PanelDTO struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Info          Info   `json:"info"`
	HideFromList  bool   `json:"hideFromList"`
	Sort          int    `json:"sort"`
	SkipDataQuery bool   `json:"skipDataQuery"`
	ReleaseState  string `json:"state"`
	BaseURL       string `json:"baseUrl"`
	Signature     string `json:"signature"`
	Module        string `json:"module"`
}

type Error struct {
	ErrorCode signature.ErrorCode `json:"errorCode"`
	PluginID  string              `json:"pluginId,omitempty"`
}

type PreloadPlugin struct {
	Path    string `json:"path"`
	Version string `json:"version"`
}
