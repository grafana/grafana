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

func TestAppLinks(t *testing.T) {
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
					Name:     "Hello",
					Path:     "/a/test-app/catalog",
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

	treeRoot := navtree.NavTreeRoot{}

	t.Run("addAppLinks should add enabled apps with pages", func(t *testing.T) {
		err := service.addAppLinks(&treeRoot, reqCtx)
		require.NoError(t, err)
		require.Equal(t, "Test app name", treeRoot.Children[0].Text)
	})
}
