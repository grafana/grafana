package plugins

import (
	"encoding/json"
	"strings"

	"github.com/gosimple/slug"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
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
}

type AppPluginRoute struct {
	Path      string                 `json:"path"`
	Method    string                 `json:"method"`
	ReqRole   models.RoleType        `json:"reqRole"`
	Url       string                 `json:"url"`
	Headers   []AppPluginRouteHeader `json:"headers"`
	TokenAuth *JwtTokenAuth          `json:"tokenAuth"`
}

type AppPluginRouteHeader struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type JwtTokenAuth struct {
	Url    string            `json:"url"`
	Params map[string]string `json:"params"`
}

func (app *AppPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&app); err != nil {
		return err
	}

	if err := app.registerPlugin(pluginDir); err != nil {
		return err
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
