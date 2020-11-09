package plugins

import (
	"encoding/json"
	"path/filepath"
	"strings"

	"github.com/gosimple/slug"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type AppPluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type AppPlugin struct {
	FrontendPluginBase
	Routes []*AppPluginRoute `json:"routes"`

	FoundChildPlugins []*PluginInclude `json:"-"`
	Pinned            bool             `json:"-"`

	Executable string `json:"executable,omitempty"`
}

// AppPluginRoute describes a plugin route that is defined in
// the plugin.json file for a plugin.
type AppPluginRoute struct {
	Path         string                   `json:"path"`
	Method       string                   `json:"method"`
	ReqRole      models.RoleType          `json:"reqRole"`
	URL          string                   `json:"url"`
	URLParams    []AppPluginRouteURLParam `json:"urlParams"`
	Headers      []AppPluginRouteHeader   `json:"headers"`
	TokenAuth    *JwtTokenAuth            `json:"tokenAuth"`
	JwtTokenAuth *JwtTokenAuth            `json:"jwtTokenAuth"`
}

// AppPluginRouteHeader describes an HTTP header that is forwarded with
// the proxied request for a plugin route
type AppPluginRouteHeader struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// AppPluginRouteURLParam describes query string parameters for
// a url in a plugin route
type AppPluginRouteURLParam struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// JwtTokenAuth struct is both for normal Token Auth and JWT Token Auth with
// an uploaded JWT file.
type JwtTokenAuth struct {
	Url    string            `json:"url"`
	Scopes []string          `json:"scopes"`
	Params map[string]string `json:"params"`
}

func (app *AppPlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendplugin.Manager) error {
	if err := decoder.Decode(app); err != nil {
		return err
	}

	if err := app.registerPlugin(base); err != nil {
		return err
	}

	if app.Backend {
		cmd := ComposePluginStartCommand(app.Executable)
		fullpath := filepath.Join(app.PluginDir, cmd)
		factory := grpcplugin.NewBackendPlugin(app.Id, fullpath, grpcplugin.PluginStartFuncs{})
		if err := backendPluginManager.Register(app.Id, factory); err != nil {
			return errutil.Wrapf(err, "failed to register backend plugin")
		}
	}

	Apps[app.Id] = app
	return nil
}

func (app *AppPlugin) initApp() {
	app.initFrontendPlugin()

	// check if we have child panels
	for _, panel := range Panels {
		if strings.HasPrefix(panel.PluginDir, app.PluginDir) {
			panel.setPathsBasedOnApp(app)
			app.FoundChildPlugins = append(app.FoundChildPlugins, &PluginInclude{
				Name: panel.Name,
				Id:   panel.Id,
				Type: panel.Type,
			})
		}
	}

	// check if we have child datasources
	for _, ds := range DataSources {
		if strings.HasPrefix(ds.PluginDir, app.PluginDir) {
			ds.setPathsBasedOnApp(app)
			app.FoundChildPlugins = append(app.FoundChildPlugins, &PluginInclude{
				Name: ds.Name,
				Id:   ds.Id,
				Type: ds.Type,
			})
		}
	}

	// slugify pages
	for _, include := range app.Includes {
		if include.Slug == "" {
			include.Slug = slug.Make(include.Name)
		}
		if include.Type == "page" && include.DefaultNav {
			app.DefaultNavUrl = setting.AppSubUrl + "/plugins/" + app.Id + "/page/" + include.Slug
		}
		if include.Type == "dashboard" && include.DefaultNav {
			app.DefaultNavUrl = setting.AppSubUrl + "/dashboard/db/" + include.Slug
		}
	}
}
