package plugins

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	PluginTypeApp        = "app"
	PluginTypeDatasource = "datasource"
	PluginTypePanel      = "panel"
	PluginTypeDashboard  = "dashboard"
)

type PluginState string

var (
	PluginStateAlpha PluginState = "alpha"
	PluginStateBeta  PluginState = "beta"
)

type PluginNotFoundError struct {
	PluginId string
}

func (e PluginNotFoundError) Error() string {
	return fmt.Sprintf("Plugin with id %s not found", e.PluginId)
}

type PluginLoader interface {
	Load(decoder *json.Decoder, pluginDir string) error
}

type PluginBase struct {
	Type         string             `json:"type"`
	Name         string             `json:"name"`
	Id           string             `json:"id"`
	Info         PluginInfo         `json:"info"`
	Dependencies PluginDependencies `json:"dependencies"`
	Includes     []*PluginInclude   `json:"includes"`
	Module       string             `json:"module"`
	BaseUrl      string             `json:"baseUrl"`
	HideFromList bool               `json:"hideFromList,omitempty"`
	State        PluginState        `json:"state,omitempty"`

	IncludedInAppId string `json:"-"`
	PluginDir       string `json:"-"`
	DefaultNavUrl   string `json:"-"`
	IsCorePlugin    bool   `json:"-"`

	GrafanaNetVersion   string `json:"-"`
	GrafanaNetHasUpdate bool   `json:"-"`
}

func (pb *PluginBase) registerPlugin(pluginDir string) error {
	if _, exists := Plugins[pb.Id]; exists {
		return errors.New("Plugin with same id already exists")
	}

	if !strings.HasPrefix(pluginDir, setting.StaticRootPath) {
		plog.Info("Registering plugin", "name", pb.Name)
	}

	if len(pb.Dependencies.Plugins) == 0 {
		pb.Dependencies.Plugins = []PluginDependencyItem{}
	}

	if pb.Dependencies.GrafanaVersion == "" {
		pb.Dependencies.GrafanaVersion = "*"
	}

	for _, include := range pb.Includes {
		if include.Role == "" {
			include.Role = m.ROLE_VIEWER
		}
	}

	pb.PluginDir = pluginDir
	Plugins[pb.Id] = pb
	return nil
}

type PluginDependencies struct {
	GrafanaVersion string                 `json:"grafanaVersion"`
	Plugins        []PluginDependencyItem `json:"plugins"`
}

type PluginInclude struct {
	Name       string     `json:"name"`
	Path       string     `json:"path"`
	Type       string     `json:"type"`
	Component  string     `json:"component"`
	Role       m.RoleType `json:"role"`
	AddToNav   bool       `json:"addToNav"`
	DefaultNav bool       `json:"defaultNav"`
	Slug       string     `json:"slug"`

	Id string `json:"-"`
}

type PluginDependencyItem struct {
	Type    string `json:"type"`
	Id      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type PluginInfo struct {
	Author      PluginInfoLink      `json:"author"`
	Description string              `json:"description"`
	Links       []PluginInfoLink    `json:"links"`
	Logos       PluginLogos         `json:"logos"`
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

func NewEnabledPlugins() EnabledPlugins {
	return EnabledPlugins{
		Panels:      make([]*PanelPlugin, 0),
		DataSources: make(map[string]*DataSourcePlugin),
		Apps:        make([]*AppPlugin, 0),
	}
}
