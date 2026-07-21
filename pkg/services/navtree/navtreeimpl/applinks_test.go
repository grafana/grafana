package navtreeimpl

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestAddAppLinks(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{SignedInUser: &user.SignedInUser{}, Context: &web.Context{Req: httpReq}}
	permissions := []ac.Permission{
		{Action: pluginaccesscontrol.ActionAppAccess, Scope: "*"},
		{Action: pluginaccesscontrol.ActionInstall, Scope: "*"},
		{Action: datasources.ActionCreate, Scope: "*"},
		{Action: datasources.ActionRead, Scope: "*"},
	}

	testApp1 := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-app1",
			Name: "Test app1 name",
			Type: plugins.TypeApp,
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

	testApp2 := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-app2",
			Name: "Test app2 name",
			Type: plugins.TypeApp,
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

	testApp3 := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-app3",
			Name: "Test app3 name",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					Name:       "Default page",
					Path:       "/a/test-app3/default",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:     "Random page",
					Path:     "/a/test-app3/random-page",
					Type:     "page",
					AddToNav: true,
				},
				{
					Name:     "Add new connection",
					Path:     "/connections/add-new-connection",
					Type:     "page",
					AddToNav: false,
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
		pluginStore: &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{testApp1, testApp2, testApp3},
		},
	}

	t.Run("Should move apps to 'More apps' category", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.NotNil(t, appsNode)
		require.Equal(t, "More apps", appsNode.Text)
		require.Len(t, appsNode.Children, 3)
		require.Equal(t, testApp1.Name, appsNode.Children[0].Text)
	})

	t.Run("Should add enabled apps with pages", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.Equal(t, "Test app1 name", appsNode.Children[0].Text)
		require.Equal(t, "/a/test-app1/catalog", appsNode.Children[0].Url)
		require.Equal(t, "/a/test-app1/page2", appsNode.Children[0].Children[0].Url)
	})

	t.Run("Should remove the default nav child (DefaultNav=true) and should set its URL to the plugin nav root", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		app1Node := treeRoot.FindById("plugin-page-test-app1")
		require.Len(t, app1Node.Children, 1) // The page include with DefaultNav=true gets removed
		require.Equal(t, "/a/test-app1/catalog", app1Node.Url)
		require.Equal(t, "Page2", app1Node.Children[0].Text)
	})

	// This can be done by using `[navigation.app_sections]` in the INI config
	t.Run("Should move apps that have root nav id configured to the root", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDRoot},
		}

		treeRoot := navtree.NavTreeRoot{}

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		// Check if the plugin gets moved to the root
		require.Len(t, treeRoot.Children, 2)
		require.Equal(t, "plugin-page-test-app1", treeRoot.Children[0].Id)

		// Check if it is not under the "More apps" section anymore
		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.NotNil(t, appsNode)
		require.Len(t, appsNode.Children, 2)
		require.Equal(t, "plugin-page-test-app2", appsNode.Children[0].Id)
		require.Equal(t, "plugin-page-test-app3", appsNode.Children[1].Id)
	})

	// This can be done by using `[navigation.app_sections]` in the INI config
	t.Run("Should move apps that have specific nav id configured to correct section", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDCfg},
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(&navtree.NavLink{
			Id: navtree.NavIDCfg,
		})

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		// Check if the plugin gets moved over to the "Admin" section
		adminNode := treeRoot.FindById(navtree.NavIDCfg)
		require.NotNil(t, adminNode)
		require.Len(t, adminNode.Children, 1)
		require.Equal(t, "plugin-page-test-app1", adminNode.Children[0].Id)

		// Check if it is not under the "More apps" section anymore
		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.NotNil(t, appsNode)
		require.Len(t, appsNode.Children, 2)
		require.Equal(t, "plugin-page-test-app2", appsNode.Children[0].Id)
		require.Equal(t, "plugin-page-test-app3", appsNode.Children[1].Id)
	})

	t.Run("Should only add an 'Observability' section if a plugin exists that wants to live there", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{}

		// Check if the Observability section is not there if no apps try to register to it
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		monitoringNode := treeRoot.FindById(navtree.NavIDObservability)
		require.Nil(t, monitoringNode)

		// It should appear and once an app tries to register to it
		treeRoot = navtree.NavTreeRoot{}
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDObservability},
		}
		err = service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		monitoringNode = treeRoot.FindById(navtree.NavIDObservability)
		require.NotNil(t, monitoringNode)
		require.Len(t, monitoringNode.Children, 1)
		require.Equal(t, "Test app1 name", monitoringNode.Children[0].Text)
	})

	t.Run("Should add a 'Alerts and Incidents' section if a plugin exists that wants to live there", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{}

		// Check if the 'Alerts and Incidents' section is not there if no apps try to register to it
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		alertsAndIncidentsNode := treeRoot.FindById(navtree.NavIDAlertsAndIncidents)
		require.Nil(t, alertsAndIncidentsNode)

		// It should appear and once an app tries to register to it and the `Alerting` nav node is present
		treeRoot = navtree.NavTreeRoot{}
		treeRoot.AddSection(&navtree.NavLink{Id: navtree.NavIDAlerting, Text: "Alerting"})
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDAlertsAndIncidents},
		}
		err = service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		alertsAndIncidentsNode = treeRoot.FindById(navtree.NavIDAlertsAndIncidents)
		require.NotNil(t, alertsAndIncidentsNode)
		require.Len(t, alertsAndIncidentsNode.Children, 2)
		require.Equal(t, "Alerting", alertsAndIncidentsNode.Children[0].Text)
		require.Equal(t, "Test app1 name", alertsAndIncidentsNode.Children[1].Text)
	})

	t.Run("Should add a 'Alerts and Incidents' section if a plugin exists that wants to live there even without an alerting node", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{}

		// Check if the 'Alerts and Incidents' section is not there if no apps try to register to it
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		alertsAndIncidentsNode := treeRoot.FindById(navtree.NavIDAlertsAndIncidents)
		require.Nil(t, alertsAndIncidentsNode)

		// If there is no 'Alerting' node in the navigation then we still auto-create the 'Alerts and Incidents' section when a plugin wants to live there
		treeRoot = navtree.NavTreeRoot{}
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDAlertsAndIncidents},
		}
		err = service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		alertsAndIncidentsNode = treeRoot.FindById(navtree.NavIDAlertsAndIncidents)
		require.NotNil(t, alertsAndIncidentsNode)
		require.Len(t, alertsAndIncidentsNode.Children, 1)
		require.Equal(t, "Test app1 name", alertsAndIncidentsNode.Children[0].Text)
	})

	t.Run("Should use plugin name when Text is not provided in nav config, and custom Text when provided", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app1": {SectionID: navtree.NavIDObservability, SortWeight: 1},                       // No Text - should use plugin.Name
			"test-app2": {SectionID: navtree.NavIDObservability, SortWeight: 2, Text: "Custom Label"}, // Text provided
		}

		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		treeRoot.Sort()
		monitoringNode := treeRoot.FindById(navtree.NavIDObservability)
		require.NotNil(t, monitoringNode)
		require.Len(t, monitoringNode.Children, 2)
		// test-app1 has no Text in config → uses plugin.Name
		require.Equal(t, "Test app1 name", monitoringNode.Children[0].Text)
		// test-app2 has Text in config → uses custom Text
		require.Equal(t, "Custom Label", monitoringNode.Children[1].Text)
	})

	t.Run("Should be able to control app sort order with SortWeight (smaller SortWeight displayed first)", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{
			"test-app2": {SectionID: navtree.NavIDObservability, SortWeight: 2},
			"test-app1": {SectionID: navtree.NavIDObservability, SortWeight: 3},
			"test-app3": {SectionID: navtree.NavIDObservability, SortWeight: 1},
		}

		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		treeRoot.Sort()
		monitoringNode := treeRoot.FindById(navtree.NavIDObservability)

		require.NoError(t, err)
		require.Equal(t, "Test app3 name", monitoringNode.Children[0].Text)
		require.Equal(t, "Test app2 name", monitoringNode.Children[1].Text)
		require.Equal(t, "Test app1 name", monitoringNode.Children[2].Text)
	})

	t.Run("Should replace page from plugin", func(t *testing.T) {
		service.navigationAppConfig = map[string]NavigationAppConfig{}
		service.navigationAppPathConfig = map[string]NavigationAppConfig{
			"/connections/add-new-connection": {SectionID: "connections"},
		}

		// Build nav-tree and check if the "Connections" page is there
		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(service.buildDataConnectionsNavLink(reqCtx))
		connectionsNode := treeRoot.FindById("connections")
		require.NotNil(t, connectionsNode)
		require.Equal(t, "Connections", connectionsNode.Text)

		// Check if the original "Add new connection" page (served by core) is there until we add the standalone plugin page
		connectDataNode := connectionsNode.Children[0]
		require.Equal(t, "Add new connection", connectDataNode.Text)
		require.Equal(t, "connections-add-new-connection", connectDataNode.Id)
		require.Equal(t, "", connectDataNode.PluginID)

		// Check if the standalone plugin page appears under the section where we registered it and if it overrides the original page
		err := service.addAppLinks(&treeRoot, reqCtx)

		require.NoError(t, err)
		require.Equal(t, "Connections", connectionsNode.Text)
		require.Equal(t, "Add new connection", connectDataNode.Text)
		require.Equal(t, "standalone-plugin-page-/connections/add-new-connection", connectDataNode.Id) // Overridden "Add new connection" page
		require.Equal(t, "test-app3", connectDataNode.PluginID)

		// Check if the standalone plugin page does not appear under the app section anymore
		// (Also checking if the Default Page got removed)
		app3Node := treeRoot.FindById("plugin-page-test-app3")
		require.NotNil(t, app3Node)
		require.Len(t, app3Node.Children, 1)
		require.Equal(t, "Random page", app3Node.Children[0].Text)

		// The plugin item should take the URL of the Default Nav
		require.Equal(t, "/a/test-app3/default", app3Node.Url)
	})

	t.Run("Should not register pages under the app plugin section unless AddToNav=true", func(t *testing.T) {
		service.navigationAppPathConfig = map[string]NavigationAppConfig{} // We don't configure it as a standalone plugin page

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(service.buildDataConnectionsNavLink(reqCtx))
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		// The original core page should exist under the section
		connectDataNode := treeRoot.FindById("connections-add-new-connection")
		require.Equal(t, "connections-add-new-connection", connectDataNode.Id)
		require.Equal(t, "", connectDataNode.PluginID)

		// The standalone plugin page should not be found in the navtree at all (as we didn't configure it)
		standaloneConnectDataNode := treeRoot.FindById("standalone-plugin-page-/connections/add-new-connection")
		require.Nil(t, standaloneConnectDataNode)

		// Only the pages that have `AddToNav=true` appear under the plugin navigation
		app3Node := treeRoot.FindById("plugin-page-test-app3")
		require.NotNil(t, app3Node)
		require.Len(t, app3Node.Children, 1) // It should only have a single child now
		require.Equal(t, "Random page", app3Node.Children[0].Text)
	})
}

func TestAssistantStubNav(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{SignedInUser: &user.SignedInUser{}, Context: &web.Context{Req: httpReq}}
	onboardingPlugin := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:          assistantOnboardingAppID,
			Name:        "Grafana Assistant Onboarding",
			Type:        plugins.TypeApp,
			AutoEnabled: true,
		},
	}
	assistantPlugin := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:          assistantAppID,
			Name:        "Grafana Assistant",
			Type:        plugins.TypeApp,
			AutoEnabled: true,
		},
	}
	appAccess := ac.Permission{Action: pluginaccesscontrol.ActionAppAccess, Scope: "*"}
	installAccess := ac.Permission{Action: pluginaccesscontrol.ActionInstall, Scope: "*"}

	tests := []struct {
		name        string
		plugins     []pluginstore.Plugin
		permissions []ac.Permission
		wantStub    bool
	}{
		{
			name:        "adds stub when onboarding plugin is enabled and Assistant is absent",
			plugins:     []pluginstore.Plugin{onboardingPlugin},
			permissions: []ac.Permission{appAccess, installAccess},
			wantStub:    true,
		},
		{
			name:        "suppresses stub when Assistant is enabled",
			plugins:     []pluginstore.Plugin{onboardingPlugin, assistantPlugin},
			permissions: []ac.Permission{appAccess, installAccess},
		},
		{
			name:        "suppresses stub when onboarding plugin is absent",
			permissions: []ac.Permission{appAccess, installAccess},
		},
		{
			name:        "adds stub when user cannot install plugins",
			plugins:     []pluginstore.Plugin{onboardingPlugin},
			permissions: []ac.Permission{appAccess},
			wantStub:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := ServiceImpl{
				log:            log.New("navtree"),
				cfg:            setting.NewCfg(),
				accessControl:  accesscontrolmock.New().WithPermissions(tt.permissions),
				pluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{}},
				features:       featuremgmt.WithFeatures(),
				pluginStore:    &pluginstore.FakePluginStore{PluginList: tt.plugins},
			}

			treeRoot := navtree.NavTreeRoot{}
			err := service.addAppLinks(&treeRoot, reqCtx)
			require.NoError(t, err)

			node := treeRoot.FindById("plugin-page-" + assistantAppID)
			if !tt.wantStub {
				require.Nil(t, node)
				return
			}

			require.NotNil(t, node)
			require.Equal(t, "Assistant", node.Text)
			require.Equal(t, "/a/"+assistantAppID, node.Url)
			require.Equal(t, "ai-sparkle", node.Icon)
			require.Equal(t, assistantAppID, node.PluginID)
			require.Equal(t, int64(navtree.WeightAssistant), node.SortWeight)
		})
	}
}

func TestAddAppLinksObservabilityAssertsOrdering(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{SignedInUser: &user.SignedInUser{}, Context: &web.Context{Req: httpReq}}
	permissions := []ac.Permission{
		{Action: pluginaccesscontrol.ActionAppAccess, Scope: "*"},
	}

	assertsApp := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "grafana-asserts-app",
			Name: "Knowledge graph",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					Name:       "Knowledge graph",
					Path:       "/a/grafana-asserts-app/",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:     "Entity graph",
					Path:     "/a/grafana-asserts-app/entities",
					Type:     "page",
					AddToNav: true,
				},
				{
					Name:     "Application",
					Path:     "/a/grafana-asserts-app/services",
					Type:     "page",
					AddToNav: true,
				},
			},
		},
	}

	frontendApp := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "grafana-kowalski-app",
			Name: "Frontend",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					Name:       "Frontend",
					Path:       "/a/grafana-kowalski-app/",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:     "Overview",
					Path:     "/a/grafana-kowalski-app/overview",
					Type:     "page",
					AddToNav: true,
				},
			},
		},
	}

	applicationApp := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "grafana-app-observability-app",
			Name: "Application",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					Name:       "Application",
					Path:       "/a/grafana-app-observability-app/",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
				},
				{
					Name:     "Services",
					Path:     "/a/grafana-app-observability-app/services",
					Type:     "page",
					AddToNav: true,
				},
			},
		},
	}

	// Enabled and accessible, but none of its includes are added to the nav, so
	// processAppPlugin returns no node. This still lands in
	// enabledAccessibleAppPluginMap yet never adds an "Application" entry, so the
	// asserts page must stay visible (exercises the tree lookup over the map).
	applicationAppNoNav := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "grafana-app-observability-app",
			Name: "Application",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					Name:     "Application",
					Path:     "/a/grafana-app-observability-app/",
					Type:     "page",
					AddToNav: false,
				},
			},
		},
	}

	newService := func(pluginList []pluginstore.Plugin) ServiceImpl {
		settings := map[string]*pluginsettings.DTO{}
		for _, p := range pluginList {
			settings[p.ID] = &pluginsettings.DTO{ID: 0, OrgID: 1, PluginID: p.ID, PluginVersion: "1.0.0", Enabled: true}
		}
		service := ServiceImpl{
			log:            log.New("navtree"),
			cfg:            setting.NewCfg(),
			accessControl:  accesscontrolmock.New().WithPermissions(permissions),
			pluginSettings: &pluginsettings.FakePluginSettings{Plugins: settings},
			features:       featuremgmt.WithFeatures(),
			pluginStore:    &pluginstore.FakePluginStore{PluginList: pluginList},
		}
		// Use the production nav defaults instead of a hand-rolled map so the test
		// exercises the real section/weight config (asserts=2, Frontend=3, Application=4).
		service.readNavigationSettings()
		return service
	}

	t.Run("without the App Observability plugin, the asserts Application page sits between Frontend and App Observability", func(t *testing.T) {
		service := newService([]pluginstore.Plugin{assertsApp, frontendApp})

		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		treeRoot.Sort()

		monitoringNode := treeRoot.FindById(navtree.NavIDObservability)
		require.NotNil(t, monitoringNode)
		require.Len(t, monitoringNode.Children, 3)

		// Asserts "Entity graph" stays hoisted to the top, then Frontend, then the
		// asserts "Application" page (weight 4).
		require.Equal(t, "Entity graph", monitoringNode.Children[0].Text)
		require.Equal(t, "Frontend", monitoringNode.Children[1].Text)
		require.Equal(t, "Application", monitoringNode.Children[2].Text)
		require.Equal(t, "standalone-plugin-page-application", monitoringNode.Children[2].Id)
	})

	t.Run("when the App Observability plugin is present, it replaces the asserts Application page", func(t *testing.T) {
		service := newService([]pluginstore.Plugin{assertsApp, frontendApp, applicationApp})

		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		treeRoot.Sort()

		monitoringNode := treeRoot.FindById(navtree.NavIDObservability)
		require.NotNil(t, monitoringNode)

		var hasAppObservability bool
		for _, child := range monitoringNode.Children {
			// The appo11y "Application" page is shown instead of the asserts "Application" page.
			if child.Text == "Application" && child.Url == "/a/grafana-app-observability-app/" {
				hasAppObservability = true
			}
			// The asserts "Application" page must not be shown when appo11y is present.
			require.NotEqual(t, "/a/grafana-asserts-app/services", child.Url)
		}

		require.True(t, hasAppObservability, "expected the appo11y Application page to be present")
	})

	t.Run("when the App Observability plugin is present but contributes no nav node, the asserts Application page stays visible", func(t *testing.T) {
		service := newService([]pluginstore.Plugin{assertsApp, frontendApp, applicationAppNoNav})

		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		treeRoot.Sort()

		monitoringNode := treeRoot.FindById(navtree.NavIDObservability)
		require.NotNil(t, monitoringNode)

		var hasAssertsApplication bool
		for _, child := range monitoringNode.Children {
			if child.Url == "/a/grafana-asserts-app/services" {
				hasAssertsApplication = true
			}
		}
		require.True(t, hasAssertsApplication, "expected the asserts Application page to stay visible when appo11y contributes no nav node")
	})
}

func TestBuildDataConnectionsNavLink(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{SignedInUser: &user.SignedInUser{}, Context: &web.Context{Req: httpReq}}

	t.Run("core items (add-new-connection, datasources) are added when user has ConfigurationPageAccess", func(t *testing.T) {
		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions([]ac.Permission{{Action: datasources.ActionCreate, Scope: "*"}}),
			features:      featuremgmt.WithFeatures(),
		}

		section := service.buildDataConnectionsNavLink(reqCtx)
		require.NotNil(t, section)
		require.Len(t, section.Children, 2)
		require.Equal(t, "connections-add-new-connection", section.Children[0].Id)
		require.Equal(t, "connections-datasources", section.Children[1].Id)
	})

	t.Run("section is returned with no core children when user lacks ConfigurationPageAccess", func(t *testing.T) {
		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions([]ac.Permission{}),
			features:      featuremgmt.WithFeatures(),
		}

		section := service.buildDataConnectionsNavLink(reqCtx)
		require.NotNil(t, section, "section must always be returned so plugins can attach children")
		require.Empty(t, section.Children)
	})

	t.Run("plugin pages under the connections section are visible to users without ConfigurationPageAccess", func(t *testing.T) {
		pluginApp := pluginstore.Plugin{
			JSONData: plugins.JSONData{
				ID:   "grafana-collector-app",
				Name: "Collector",
				Type: plugins.TypeApp,
				Includes: []*plugins.Includes{
					{
						Name:     "Collector",
						Path:     "/a/grafana-collector-app",
						Type:     "page",
						AddToNav: false,
					},
				},
			},
		}
		pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
			pluginApp.ID: {ID: 0, OrgID: 1, PluginID: pluginApp.ID, PluginVersion: "1.0.0", Enabled: true},
		}}
		service := ServiceImpl{
			cfg: setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions([]ac.Permission{
				{Action: pluginaccesscontrol.ActionAppAccess, Scope: "*"},
			}),
			pluginSettings: &pluginSettings,
			features:       featuremgmt.WithFeatures(),
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{pluginApp},
			},
		}
		service.navigationAppPathConfig = map[string]NavigationAppConfig{
			"/a/grafana-collector-app": {SectionID: "connections"},
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(service.buildDataConnectionsNavLink(reqCtx))
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		connectionsNode := treeRoot.FindById("connections")
		require.NotNil(t, connectionsNode)
		require.Len(t, connectionsNode.Children, 1)
		require.Equal(t, "standalone-plugin-page-/a/grafana-collector-app", connectionsNode.Children[0].Id)
	})

	t.Run("RemoveEmptyConnectionsSection removes the section when it has no children", func(t *testing.T) {
		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions([]ac.Permission{}),
			features:      featuremgmt.WithFeatures(),
			pluginStore:   &pluginstore.FakePluginStore{},
			pluginSettings: &pluginsettings.FakePluginSettings{
				Plugins: map[string]*pluginsettings.DTO{},
			},
		}

		treeRoot := navtree.NavTreeRoot{}
		treeRoot.AddSection(service.buildDataConnectionsNavLink(reqCtx))
		require.NotNil(t, treeRoot.FindById("connections"), "section should exist before app links are applied")

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		treeRoot.RemoveEmptyConnectionsSection()
		require.Nil(t, treeRoot.FindById("connections"), "empty section should be pruned")
	})
}

func TestReadingNavigationSettings(t *testing.T) {
	t.Run("Should include defaults", func(t *testing.T) {
		service := ServiceImpl{
			cfg:      setting.NewCfg(),
			features: featuremgmt.WithFeatures(),
		}

		_, _ = service.cfg.Raw.NewSection("navigation.app_sections")
		service.readNavigationSettings()

		require.Equal(t, "observability", service.navigationAppConfig["grafana-k8s-app"].SectionID)
	})

	t.Run("Can add additional overrides via ini system", func(t *testing.T) {
		service := ServiceImpl{
			cfg:      setting.NewCfg(),
			features: featuremgmt.WithFeatures(),
		}

		appSections, _ := service.cfg.Raw.NewSection("navigation.app_sections")
		appStandalonePages, _ := service.cfg.Raw.NewSection("navigation.app_standalone_pages")
		_, _ = appSections.NewKey("grafana-k8s-app", "dashboards")
		_, _ = appSections.NewKey("other-app", "admin 12")
		_, _ = appStandalonePages.NewKey("/a/grafana-k8s-app/foo", "admin 30")

		service.readNavigationSettings()

		require.Equal(t, "dashboards", service.navigationAppConfig["grafana-k8s-app"].SectionID)
		require.Equal(t, "admin", service.navigationAppConfig["other-app"].SectionID)

		require.Equal(t, int64(6), service.navigationAppConfig["grafana-k8s-app"].SortWeight)
		require.Equal(t, int64(12), service.navigationAppConfig["other-app"].SortWeight)

		require.Equal(t, "admin", service.navigationAppPathConfig["/a/grafana-k8s-app/foo"].SectionID)
		require.Equal(t, int64(30), service.navigationAppPathConfig["/a/grafana-k8s-app/foo"].SortWeight)
	})
}

func TestAddAppLinksAccessControl(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	user := &user.SignedInUser{OrgID: 1}
	reqCtx := &contextmodel.ReqContext{SignedInUser: user, Context: &web.Context{Req: httpReq}}
	catalogReadAction := "test-app1.catalog:read"

	testApp1 := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "test-app1", Name: "Test app1 name", Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					Name:       "Home",
					Path:       "/a/test-app1/home",
					Type:       "page",
					AddToNav:   true,
					DefaultNav: true,
					Role:       identity.RoleViewer,
				},
				{
					Name:     "Catalog",
					Path:     "/a/test-app1/catalog",
					Type:     "page",
					AddToNav: true,
					Role:     identity.RoleEditor,
					Action:   catalogReadAction,
				},
				{
					Name:     "Announcements",
					Path:     "/a/test-app1/announcements",
					Type:     "page",
					AddToNav: true,
					Role:     identity.RoleViewer,
					Action:   pluginaccesscontrol.ActionAppAccess,
				},
			},
		},
	}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		testApp1.ID: {ID: 0, OrgID: 1, PluginID: testApp1.ID, PluginVersion: "1.0.0", Enabled: true},
	}}

	cfg := setting.NewCfg()

	service := ServiceImpl{
		log:            log.New("navtree"),
		cfg:            cfg,
		accessControl:  acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		pluginSettings: &pluginSettings,
		features:       featuremgmt.WithFeatures(),
		pluginStore: &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{testApp1},
		},
	}

	t.Run("Should not see any includes with no app access", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		user.Permissions = map[int64]map[string][]string{
			1: {pluginaccesscontrol.ActionAppAccess: []string{"plugins:id:not-the-test-app1"}},
		}
		user.OrgRole = identity.RoleNone
		service.features = featuremgmt.WithFeatures()

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Len(t, treeRoot.Children, 0)
	})
	t.Run("Should only see the announcements as a none role user with app access", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		user.Permissions = map[int64]map[string][]string{
			1: {pluginaccesscontrol.ActionAppAccess: []string{"plugins:id:test-app1"}},
		}
		user.OrgRole = identity.RoleNone
		service.features = featuremgmt.WithFeatures()

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.Len(t, appsNode.Children, 1)
		require.Equal(t, "Test app1 name", appsNode.Children[0].Text)
		require.Len(t, appsNode.Children[0].Children, 1)
		require.Equal(t, "/a/test-app1/announcements", appsNode.Children[0].Children[0].Url)
	})
	t.Run("Should now see the catalog as a viewer with catalog read", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		user.Permissions = map[int64]map[string][]string{
			1: {pluginaccesscontrol.ActionAppAccess: []string{"plugins:id:test-app1"}, catalogReadAction: []string{}},
		}
		user.OrgRole = identity.RoleViewer
		service.features = featuremgmt.WithFeatures()

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.Len(t, appsNode.Children, 1)
		require.Equal(t, "Test app1 name", appsNode.Children[0].Text)
		require.Equal(t, "/a/test-app1/home", appsNode.Children[0].Url)
		require.Len(t, appsNode.Children[0].Children, 2)
		require.Equal(t, "/a/test-app1/catalog", appsNode.Children[0].Children[0].Url)
		require.Equal(t, "/a/test-app1/announcements", appsNode.Children[0].Children[1].Url)
	})
	t.Run("Should not see the catalog include as an editor without catalog read", func(t *testing.T) {
		treeRoot := navtree.NavTreeRoot{}
		user.Permissions = map[int64]map[string][]string{
			1: {pluginaccesscontrol.ActionAppAccess: []string{"*"}},
		}
		user.OrgRole = identity.RoleEditor
		service.features = featuremgmt.WithFeatures()

		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		appsNode := treeRoot.FindById(navtree.NavIDApps)
		require.Len(t, appsNode.Children, 1)
		require.Equal(t, "Test app1 name", appsNode.Children[0].Text)
		require.Equal(t, "/a/test-app1/home", appsNode.Children[0].Url)
		require.Len(t, appsNode.Children[0].Children, 1)
		require.Equal(t, "/a/test-app1/announcements", appsNode.Children[0].Children[0].Url)
	})
}

func TestProcessAssistantAppPlugin(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{OrgRole: identity.RoleAdmin},
		Context:      &web.Context{Req: httpReq},
	}
	assistantApp := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   assistantAppID,
			Name: "Assistant",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{Name: "Home", Path: "/a/grafana-assistant-app", Type: "page", AddToNav: true, DefaultNav: true},
				{Name: "Workspace", Path: "/a/grafana-assistant-app/workspace", Type: "page", AddToNav: true},
				{Name: "Settings", Path: "/a/grafana-assistant-app/settings", Type: "page", AddToNav: true},
				{Name: "Irrelevant", Path: "/a/grafana-assistant-app/irrelevant", Type: "page", AddToNav: true},
			},
		},
	}

	for _, tt := range []struct {
		name           string
		cfg            *setting.Cfg
		trialMode      bool
		wantChildPaths []string
	}{
		{
			name: "OSS only includes supported entries",
			cfg:  setting.NewCfg(),
			wantChildPaths: []string{
				"/a/grafana-assistant-app/workspace",
				"/a/grafana-assistant-app/settings",
			},
		},
		{
			name: "Enterprise includes all entries",
			cfg:  &setting.Cfg{IsEnterprise: true},
			wantChildPaths: []string{
				"/a/grafana-assistant-app/workspace",
				"/a/grafana-assistant-app/settings",
				"/a/grafana-assistant-app/irrelevant",
			},
		},
		{
			name: "Cloud includes all entries",
			cfg:  &setting.Cfg{StackID: "1"},
			wantChildPaths: []string{
				"/a/grafana-assistant-app/workspace",
				"/a/grafana-assistant-app/settings",
				"/a/grafana-assistant-app/irrelevant",
			},
		},
		{
			name:      "Trial mode only includes the homepage",
			cfg:       setting.NewCfg(),
			trialMode: true,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service := ServiceImpl{
				cfg: tt.cfg,
				pluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
					assistantAppID: {OrgID: 1, PluginID: assistantAppID, JSONData: map[string]any{"trialMode": tt.trialMode}},
				}},
			}
			treeRoot := navtree.NavTreeRoot{}
			service.processAppPlugin(assistantApp, reqCtx, &treeRoot)
			appLink := treeRoot.FindById("plugin-page-" + assistantAppID)

			require.NotNil(t, appLink)
			require.Equal(t, "/a/grafana-assistant-app", appLink.Url)
			require.Len(t, appLink.Children, len(tt.wantChildPaths))
			for i, wantPath := range tt.wantChildPaths {
				require.Equal(t, wantPath, appLink.Children[i].Url)
			}
		})
	}
}

func TestNestMaintenanceWindowsUnderSLO(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{SignedInUser: &user.SignedInUser{}, Context: &web.Context{Req: httpReq}}
	permissions := []ac.Permission{
		{Action: pluginaccesscontrol.ActionAppAccess, Scope: "*"},
	}

	sloApp := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "grafana-slo-app", Name: "SLO", Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{Name: "Home", Path: "/a/grafana-slo-app/home", Type: "page", AddToNav: true, DefaultNav: true},
				{Name: "Manage SLOs", Path: "/a/grafana-slo-app/manage-slos", Type: "page", AddToNav: true},
			},
		},
	}
	mwApp := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "grafana-maintenancewindows-app", Name: "Maintenance Windows", Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{Name: "Maintenance windows", Path: "/a/grafana-maintenancewindows-app/maintenance-windows", Type: "page", AddToNav: true, DefaultNav: true},
			},
		},
	}

	newService := func(plugins ...pluginstore.Plugin) ServiceImpl {
		ps := map[string]*pluginsettings.DTO{}
		list := make([]pluginstore.Plugin, 0, len(plugins))
		for _, p := range plugins {
			ps[p.ID] = &pluginsettings.DTO{OrgID: 1, PluginID: p.ID, PluginVersion: "1.0.0", Enabled: true}
			list = append(list, p)
		}
		return ServiceImpl{
			log:            log.New("navtree"),
			cfg:            setting.NewCfg(),
			accessControl:  accesscontrolmock.New().WithPermissions(permissions),
			pluginSettings: &pluginsettings.FakePluginSettings{Plugins: ps},
			features:       featuremgmt.WithFeatures(),
			pluginStore:    &pluginstore.FakePluginStore{PluginList: list},
			navigationAppConfig: map[string]NavigationAppConfig{
				"grafana-slo-app": {SectionID: navtree.NavIDRoot},
			},
		}
	}

	t.Run("Should nest Maintenance Windows under SLO when both are enabled", func(t *testing.T) {
		service := newService(sloApp, mwApp)
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		require.Nil(t, treeRoot.FindById("plugin-page-grafana-maintenancewindows-app"))

		sloNode := treeRoot.FindById("plugin-page-grafana-slo-app")
		require.NotNil(t, sloNode)
		mwChild := navtree.FindByURL(sloNode.Children, "/a/grafana-maintenancewindows-app/maintenance-windows")
		require.NotNil(t, mwChild)
		require.Equal(t, "Maintenance Windows", mwChild.Text)
		require.Equal(t, "grafana-maintenancewindows-app", mwChild.PluginID)
		require.Equal(t, "standalone-plugin-page-grafana-maintenancewindows-app", mwChild.Id)
		require.True(t, mwChild.IsNew)

		require.Nil(t, treeRoot.FindById(navtree.NavIDApps))
	})

	t.Run("Should keep Maintenance Windows as its own app when SLO is not enabled", func(t *testing.T) {
		service := newService(mwApp)
		treeRoot := navtree.NavTreeRoot{}
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)

		require.Nil(t, treeRoot.FindById("plugin-page-grafana-slo-app"))
		require.NotNil(t, treeRoot.FindById("plugin-page-grafana-maintenancewindows-app"))
	})
}
