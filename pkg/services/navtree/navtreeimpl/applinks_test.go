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

	testApp1 := plugins.PluginDTO{
		JSONData: plugins.JSONData{
			ID:   "test-app1",
			Name: "Test app1 name",
			Type: plugins.App,
			Includes: []*plugins.Includes{
				{
					Name:       "Catalog",
					Path:       "/a/test-app1/catalog",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:     "Page2",
					Path:     "/a/test-app1/page2",
					Type:     "page",
					AddToNav: true,
				},
			},
		},
	}

	testApp2 := plugins.PluginDTO{
		JSONData: plugins.JSONData{
			ID:   "test-app2",
			Name: "Test app2 name",
			Type: plugins.App,
			Includes: []*plugins.Includes{
				{
					Name:       "Hello",
					Path:       "/a/quick-app/catalog",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
			},
		},
	}

	testApp3 := plugins.PluginDTO{
		JSONData: plugins.JSONData{
			ID:   "test-app3",
			Name: "Test app3 name",
			Type: plugins.App,
			Includes: []*plugins.Includes{
				{
					Name:       "Random page",
					Path:       "/a/test-app3/random-page",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:       "Connect data",
					Path:       "/connections/connect-data",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
					IsCorePage: true,
				},
			},
		},
	}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		testApp1.ID: {ID: 0, OrgID: 1, PluginID: testApp1.ID, PluginVersion: "1.0.0", Enabled: true},
		testApp2.ID: {ID: 0, OrgID: 1, PluginID: testApp2.ID, PluginVersion: "1.0.0", Enabled: true},
		testApp3.ID: {ID: 0, OrgID: 1, PluginID: testApp3.ID, PluginVersion: "1.0.0", Enabled: true},
	}}

	service := ServiceImpl{
		log:            log.New("navtree"),
		cfg:            setting.NewCfg(),
		accessControl:  accesscontrolmock.New().WithPermissions(permissions),
		pluginSettings: &pluginSettings,
		features:       featuremgmt.WithFeatures(),
		pluginStore: plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{testApp1, testApp2, testApp3},
		},
	}

	t.Run("Should add enabled apps with pages", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Test app1 name", treeRoot.Children[0].Text)
		require.Equal(t, "/a/test-app1/catalog", treeRoot.Children[0].Url)
		require.Equal(t, "/a/test-app1/page2", treeRoot.Children[0].Children[1].Url)
	})

	t.Run("Should move apps to Apps category when topnav is enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Apps", treeRoot.Children[0].Text)
		require.Equal(t, "Test app1 name", treeRoot.Children[0].Children[0].Text)
	})

	t.Run("Should remove add default nav child when topnav is enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Apps", treeRoot.Children[0].Text)
		require.Equal(t, "Test app1 name", treeRoot.Children[0].Children[0].Text)
		require.Equal(t, "Page2", treeRoot.Children[0].Children[0].Children[0].Text)
	})

	t.Run("Should move apps that have specific nav id configured to correct section", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDAdmin},
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(&navtree.NavLink{
			Id: navtree.NavIDAdmin,
		})

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "plugin-page-test-app1", treeRoot.Children[0].Children[0].Id)
	})

	t.Run("Should add monitoring section if plugin exists that wants to live there", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDMonitoring},
		}

		treeRoot := navtree.NavTreeRoot{}

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Monitoring", treeRoot.Children[0].Text)
		require.Equal(t, "Test app1 name", treeRoot.Children[0].Children[0].Text)
	})

	t.Run("Should add Alerts and incidents section if plugin exists that wants to live there", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDAlertsAndIncidents},
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(&navtree.NavLink{Id: navtree.NavIDAlerting, Text: "Alerting"})

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Alerts & incidents", treeRoot.Children[0].Text)
		require.Equal(t, "Alerting", treeRoot.Children[0].Children[0].Text)
		require.Equal(t, "Test app1 name", treeRoot.Children[0].Children[1].Text)
	})

	t.Run("Should be able to control app sort order with SortWeight", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav)
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app2": {SectionID: navtree.NavIDMonitoring, SortWeight: 1},
			"test-app1": {SectionID: navtree.NavIDMonitoring, SortWeight: 2},
		}

		treeRoot := navtree.NavTreeRoot{}

		err := service.addAppLinks(&treeRoot, reqCtx)

		treeRoot.Sort()

		require.NoError(t, err)
		require.Equal(t, "Test app2 name", treeRoot.Children[0].Children[0].Text)
		require.Equal(t, "Test app1 name", treeRoot.Children[0].Children[1].Text)
	})

	t.Run("Should replace page from plugin", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav, featuremgmt.FlagDataConnectionsConsole)
		service.navigationAppPathConfig = map[string]NavigationAppConfig{
			"/connections/connect-data": {SectionID: "connections"},
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(service.buildDataConnectionsNavLink(reqCtx))
		require.Equal(t, "Connections", treeRoot.Children[0].Text)
		require.Equal(t, "Connect Data", treeRoot.Children[0].Children[1].Text)
		require.Equal(t, "connections-connect-data", treeRoot.Children[0].Children[1].Id)
		require.Equal(t, "", treeRoot.Children[0].Children[1].PluginID)

		err := service.addAppLinks(&treeRoot, reqCtx)

		// Check if the standalone plugin page appears under the section where we registered it
		require.NoError(t, err)
		require.Equal(t, "Connections", treeRoot.Children[0].Text)
		require.Equal(t, "Connect Data", treeRoot.Children[0].Children[1].Text)
		require.Equal(t, "standalone-plugin-page-/connections/connect-data", treeRoot.Children[0].Children[1].Id)
		require.Equal(t, "test-app3", treeRoot.Children[0].Children[1].PluginID)

		// Check if the page does not appear under the apps section
		require.Equal(t, "Connect Data", treeRoot.Children[0].Children[1].Text)
	})

	t.Run("Should not register isCorePage=true pages under the app plugin section by default", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagTopnav, featuremgmt.FlagDataConnectionsConsole)
		service.navigationAppPathConfig = map[string]NavigationAppConfig{} // We don't configure it as a standalone plugin page

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(service.buildDataConnectionsNavLink(reqCtx))
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		// The original core page should exist under the section
		connectDataNode := treeRoot.FindById("connections-connect-data")
		require.Equal(t, "connections-connect-data", connectDataNode.Id)
		require.Equal(t, "", connectDataNode.PluginID)

		// The standalone plugin page should not be found in the navtree at all
		standaloneConnectDataNode := treeRoot.FindById("standalone-plugin-page-/connections/connect-data")
		require.Nil(t, standaloneConnectDataNode)

		// The plugin page without "isCorePage=true" still appears under the plugin navigation
		app3Node := treeRoot.FindById("plugin-page-test-app3")
		require.NotNil(t, app3Node)
		require.Len(t, app3Node.Children, 1) // It should only have a single child now
		require.Equal(t, "Random page", app3Node.Children[0].Text)

	})
}

func TestReadingNavigationSettings(t *testing.T) {
	t.Run("Should include defaults", func(t *testing.T) {
		service := ServiceImpl{
			cfg: setting.NewCfg(),
		}

		_, _ = service.cfg.Raw.NewSection("navigation.app_sections")
		service.readNavigationSettings()

		require.Equal(t, "monitoring", service.navigationAppConfig["grafana-k8s-app"].SectionID)
	})

	t.Run("Can add additional overrides via ini system", func(t *testing.T) {
		service := ServiceImpl{
			cfg: setting.NewCfg(),
		}

		appSections, _ := service.cfg.Raw.NewSection("navigation.app_sections")
		appStandalonePages, _ := service.cfg.Raw.NewSection("navigation.app_standalone_pages")
		_, _ = appSections.NewKey("grafana-k8s-app", "dashboards")
		_, _ = appSections.NewKey("other-app", "admin 12")
		_, _ = appStandalonePages.NewKey("/a/grafana-k8s-app/foo", "admin 30")

		service.readNavigationSettings()

		require.Equal(t, "dashboards", service.navigationAppConfig["grafana-k8s-app"].SectionID)
		require.Equal(t, "admin", service.navigationAppConfig["other-app"].SectionID)

		require.Equal(t, int64(0), service.navigationAppConfig["grafana-k8s-app"].SortWeight)
		require.Equal(t, int64(12), service.navigationAppConfig["other-app"].SortWeight)

		require.Equal(t, "admin", service.navigationAppPathConfig["/a/grafana-k8s-app/foo"].SectionID)
		require.Equal(t, int64(30), service.navigationAppPathConfig["/a/grafana-k8s-app/foo"].SortWeight)
	})
}
