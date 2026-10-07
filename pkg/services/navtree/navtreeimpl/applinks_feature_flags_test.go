package navtreeimpl

import (
	"net/http"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestPluginIncludeFeatureFlags(t *testing.T) {
	openfeatureTestMutex.Lock()
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
	targeted := setting.NewInMemoryFlag("plugin.targeted", false)
	evaluate := func(_ memprovider.InMemoryFlag, ctx openfeature.FlattenedContext) (any, openfeature.ProviderResolutionDetail) {
		return ctx["namespace"] == "stacks-enabled", openfeature.ProviderResolutionDetail{}
	}
	targeted.ContextEvaluator = &evaluate
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		"plugin.enabled":  setting.NewInMemoryFlag("plugin.enabled", true),
		"plugin.disabled": setting.NewInMemoryFlag("plugin.disabled", false),
		"plugin.invalid":  setting.NewInMemoryFlag("plugin.invalid", "not a boolean"),
		"plugin.targeted": targeted,
	})
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))

	for _, tt := range []struct {
		name        string
		flag        string
		role        identity.RoleType
		action      string
		permissions []ac.Permission
		namespace   string
		dashboard   bool
		standalone  bool
		defaultNav  bool
		visible     bool
	}{
		{name: "no flag preserves visibility", visible: true},
		{name: "enabled flag", flag: "plugin.enabled", visible: true},
		{name: "disabled flag", flag: "plugin.disabled"},
		{name: "unknown flag", flag: "plugin.missing"},
		{name: "evaluation type error", flag: "plugin.invalid"},
		{name: "enabled flag does not bypass role", flag: "plugin.enabled", role: identity.RoleAdmin},
		{name: "enabled flag does not bypass RBAC", flag: "plugin.enabled", action: "plugin:read"},
		{name: "enabled flag and RBAC", flag: "plugin.enabled", action: "plugin:read", permissions: []ac.Permission{{Action: "plugin:read"}}, visible: true},
		{name: "RBAC does not bypass disabled flag", flag: "plugin.disabled", action: "plugin:read", permissions: []ac.Permission{{Action: "plugin:read"}}},
		{name: "request context enables flag", flag: "plugin.targeted", namespace: "stacks-enabled", visible: true},
		{name: "request context disables flag", flag: "plugin.targeted", namespace: "stacks-disabled"},
		{name: "enabled dashboard", flag: "plugin.enabled", dashboard: true, visible: true},
		{name: "disabled dashboard", flag: "plugin.disabled", dashboard: true},
		{name: "enabled standalone page", flag: "plugin.enabled", standalone: true, visible: true},
		{name: "disabled standalone page", flag: "plugin.disabled", standalone: true},
		{name: "enabled default page", flag: "plugin.enabled", defaultNav: true, visible: true},
		{name: "disabled default page", flag: "plugin.disabled", defaultNav: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			httpReq, err := http.NewRequest(http.MethodGet, "/", nil)
			require.NoError(t, err)
			httpReq = httpReq.WithContext(openfeature.WithTransactionContext(httpReq.Context(),
				openfeature.NewEvaluationContext(tt.namespace, map[string]any{"namespace": tt.namespace})))
			reqCtx := &contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{OrgRole: identity.RoleViewer},
				Context:      &web.Context{Req: httpReq},
			}
			include := &plugins.Includes{
				Name: "Gated", Path: "/a/flag-app/gated", Type: "page", AddToNav: true,
				FeatureFlag: tt.flag, Role: tt.role, Action: tt.action, DefaultNav: tt.defaultNav,
			}
			if tt.dashboard {
				include.Type = "dashboard"
				include.UID = "gated-dashboard"
			}
			app := pluginstore.Plugin{JSONData: plugins.JSONData{
				ID: "flag-app", Name: "Flag app", Type: plugins.TypeApp, Includes: []*plugins.Includes{
					{Name: "Home", Path: "/a/flag-app", Type: "page", AddToNav: true, DefaultNav: true},
					include,
				},
			}}
			service := ServiceImpl{
				log: log.New("navtree"), cfg: setting.NewCfg(),
				accessControl: accesscontrolmock.New().WithPermissions(tt.permissions),
				features:      featuremgmt.WithFeatures(),
			}
			service.cfg.AppSubURL = "/grafana"
			tree := navtree.NavTreeRoot{}
			if tt.standalone {
				service.navigationAppPathConfig = map[string]NavigationAppConfig{include.Path: {SectionID: "target"}}
				tree.AddSection(&navtree.NavLink{Id: "target"})
			}
			service.processAppPlugin(app, reqCtx, &tree)
			appNode := tree.FindById("plugin-page-flag-app")
			require.NotNil(t, appNode)
			if tt.defaultNav && tt.visible {
				require.Equal(t, "/grafana/a/flag-app/gated", appNode.Url)
				require.Len(t, appNode.Children, 1)
				require.Equal(t, "/grafana/a/flag-app", appNode.Children[0].Url)
				return
			}
			require.Equal(t, "/grafana/a/flag-app", appNode.Url)
			children := appNode.Children
			if tt.standalone {
				require.Empty(t, children)
				children = tree.FindById("target").Children
			}
			if !tt.visible {
				require.Empty(t, children)
				return
			}
			require.Len(t, children, 1)
			if tt.dashboard {
				require.Equal(t, "/grafana/d/gated-dashboard", children[0].Url)
			} else {
				require.Equal(t, "/grafana/a/flag-app/gated", children[0].Url)
			}
		})
	}
}
