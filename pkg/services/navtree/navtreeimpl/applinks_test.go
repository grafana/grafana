package navtreeimpl

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestAddAppLinks(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &models.ReqContext{SignedInUser: &user.SignedInUser{}, Context: &web.Context{Req: httpReq}}
	permissions := []ac.Permission{
		{Action: plugins.ActionAppAccess, Scope: "*"},
	}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		"test-app": {ID: 0, OrgID: 1, PluginID: "test-app", PluginVersion: "1.0.0", Enabled: true},
	}}

	testApp := plugins.PluginDTO{
		JSONData: plugins.JSONData{
			ID:   "test-app",
			Name: "Test app name",
			Type: plugins.App,
			Includes: []*plugins.Includes{
				{
					Name:       "Hello",
					Path:       "/a/test-app/catalog",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:     "Hello",
					Path:     "/a/test-app/page2",
					Type:     "page",
					AddToNav: true,
				},
			},
		},
	}

	service := ServiceImpl{
		log:            log.New("navtree"),
		cfg:            setting.NewCfg(),
		accessControl:  accesscontrolmock.New().WithPermissions(permissions),
		pluginSettings: &pluginSettings,
		features:       featuremgmt.WithFeatures(),
		pluginStore: plugins.FakePluginStore{
			PluginMap: map[string]plugins.PluginDTO{
				"test-app": testApp,
			},
		},
	}

	t.Run("Should add enabled apps with pages", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Test app name", treeRoot.Children[0].Text)
		require.Equal(t, "/a/test-app/catalog", treeRoot.Children[0].Url)
		require.Equal(t, "/a/test-app/page2", treeRoot.Children[0].Children[1].Url)
	})

	t.Run("Should move apps to Apps category when topnav is enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Apps", treeRoot.Children[0].Text)
		require.Equal(t, "Test app name", treeRoot.Children[0].Children[0].Text)
	})

	t.Run("Should move apps that have specific nav id configured to correct section", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		service.cfg.NavigationAppNavIds = map[string]string{
			"test-app": "admin",
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(&navtree.NavLink{
			Id: "admin",
		})

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "plugin-page-test-app", treeRoot.Children[0].Children[0].Id)
	})

	t.Run("Add monitoring section if plugin exists that wants to live there", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		service.cfg.NavigationAppNavIds = map[string]string{
			"test-app": "monitoring",
		}

		treeRoot := navtree.NavTreeRoot{}

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Monitoring", treeRoot.Children[0].Text)
		require.Equal(t, "Test app name", treeRoot.Children[0].Children[0].Text)
	})
}
