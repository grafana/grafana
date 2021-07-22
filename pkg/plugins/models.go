package plugins

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

const (
	PluginTypeApp       = "app"
	PluginTypeDashboard = "dashboard"
)

var (
	ErrInstallCorePlugin           = errors.New("cannot install a Core plugin")
	ErrUninstallCorePlugin         = errors.New("cannot uninstall a Core plugin")
	ErrUninstallOutsideOfPluginDir = errors.New("cannot uninstall a plugin outside")
	ErrPluginNotInstalled          = errors.New("plugin is not installed")
)

type PluginNotFoundError struct {
	PluginID string
}

func (e PluginNotFoundError) Error() string {
	return fmt.Sprintf("plugin with ID '%s' not found", e.PluginID)
}

type DuplicatePluginError struct {
	PluginID          string
	ExistingPluginDir string
}

func (e DuplicatePluginError) Error() string {
	return fmt.Sprintf("plugin with ID '%s' already exists in '%s'", e.PluginID, e.ExistingPluginDir)
}

func (e DuplicatePluginError) Is(err error) bool {
	// nolint:errorlint
	_, ok := err.(DuplicatePluginError)
	return ok
}

// PluginLoader can load a plugin.
type PluginLoader interface {
	// Load loads a plugin and returns it.
	Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendplugin.Manager) (interface{}, error)
}

// PluginBase is the base plugin type.
type PluginBase struct {
	Type         string                `json:"type"`
	Name         string                `json:"name"`
	Id           string                `json:"id"`
	Info         PluginInfo            `json:"info"`
	Dependencies PluginDependencies    `json:"dependencies"`
	Includes     []*PluginInclude      `json:"includes"`
	Module       string                `json:"module"`
	BaseUrl      string                `json:"baseUrl"`
	Category     string                `json:"category"`
	HideFromList bool                  `json:"hideFromList,omitempty"`
	Preload      bool                  `json:"preload"`
	State        PluginState           `json:"state,omitempty"`
	Signature    PluginSignatureStatus `json:"signature"`
	Backend      bool                  `json:"backend"`

	IncludedInAppId string              `json:"-"`
	PluginDir       string              `json:"-"`
	DefaultNavUrl   string              `json:"-"`
	IsCorePlugin    bool                `json:"-"`
	SignatureType   PluginSignatureType `json:"-"`
	SignatureOrg    string              `json:"-"`

	GrafanaNetVersion   string `json:"-"`
	GrafanaNetHasUpdate bool   `json:"-"`

	Root *PluginBase
}

type PluginDependencies struct {
	GrafanaVersion string                 `json:"grafanaVersion"`
	Plugins        []PluginDependencyItem `json:"plugins"`
}

type PluginInclude struct {
	Name       string          `json:"name"`
	Path       string          `json:"path"`
	Type       string          `json:"type"`
	Component  string          `json:"component"`
	Role       models.RoleType `json:"role"`
	AddToNav   bool            `json:"addToNav"`
	DefaultNav bool            `json:"defaultNav"`
	Slug       string          `json:"slug"`
	Icon       string          `json:"icon"`
	UID        string          `json:"uid"`

	Id string `json:"-"`
}

func (e PluginInclude) GetSlugOrUIDLink() string {
	if len(e.UID) > 0 {
		return "/d/" + e.UID
	} else {
		return "/dashboard/db/" + e.Slug
	}
}

type PluginDependencyItem struct {
	Type    string `json:"type"`
	Id      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type PluginBuildInfo struct {
	Time   int64  `json:"time,omitempty"`
	Repo   string `json:"repo,omitempty"`
	Branch string `json:"branch,omitempty"`
	Hash   string `json:"hash,omitempty"`
}

type PluginInfo struct {
	Author      PluginInfoLink      `json:"author"`
	Description string              `json:"description"`
	Links       []PluginInfoLink    `json:"links"`
	Logos       PluginLogos         `json:"logos"`
	Build       PluginBuildInfo     `json:"build"`
	Screenshots []PluginScreenshots `json:"screenshots"`
	Version     string              `json:"version"`
	Updated     string              `json:"updated"`
}

type PluginInfoLink struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

type PluginLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

type PluginScreenshots struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

type PluginStaticRoute struct {
	Directory string
	PluginId  string
}

type EnabledPlugins struct {
	Panels      []*PanelPlugin
	DataSources map[string]*DataSourcePlugin
	Apps        []*AppPlugin
}
