package navtreeimpl

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestGetAdminNode_LabsNavLink(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	cfg := setting.NewCfg()

	newService := func(permissions []accesscontrol.Permission) *ServiceImpl {
		return &ServiceImpl{
			cfg:           cfg,
			accessControl: mock.New().WithPermissions(permissions),
			authnService: &authntest.FakeService{
				ExpectedIdentity: &authn.Identity{},
				ExpectedErr:      errors.New("skip global identity in test"),
			},
			features: featuremgmt.WithFeatures(),
			license:  &licensing.OSSLicensingService{Cfg: cfg, HooksService: hooks.ProvideService()},
		}
	}

	reqCtx := func(isGrafanaAdmin bool) *contextmodel.ReqContext {
		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				OrgID:          1,
				OrgRole:        identity.RoleViewer,
				IsGrafanaAdmin: isGrafanaAdmin,
			},
			Context: &web.Context{Req: httpReq},
			Logger:  log.NewNopLogger(),
		}
	}

	findLabs := func(children []*navtree.NavLink) *navtree.NavLink {
		general := navtree.FindById(children, navtree.NavIDCfgGeneral)
		if general == nil {
			return nil
		}
		for _, link := range general.Children {
			if link.Id == "cfg/labs" {
				return link
			}
		}
		return nil
	}

	t.Run("includes labs when user is Grafana admin", func(t *testing.T) {
		svc := newService(nil)
		root, err := svc.getAdminNode(reqCtx(true))
		require.NoError(t, err)

		labs := findLabs(root.Children)
		require.NotNil(t, labs, "expected Labs nav link under Administration > General")
		require.Equal(t, "Labs", labs.Text)
		require.Equal(t, cfg.AppSubURL+"/admin/labs", labs.Url)
	})

	t.Run("omits labs when user has featuremgmt.write but is not Grafana admin", func(t *testing.T) {
		svc := newService([]accesscontrol.Permission{{Action: accesscontrol.ActionFeatureManagementWrite}})
		root, err := svc.getAdminNode(reqCtx(false))
		require.NoError(t, err)
		require.Nil(t, findLabs(root.Children))
	})

	t.Run("omits labs without Grafana admin and without featuremgmt permissions", func(t *testing.T) {
		svc := newService([]accesscontrol.Permission{
			{Action: accesscontrol.ActionSettingsRead, Scope: accesscontrol.ScopeSettingsAll},
		})
		root, err := svc.getAdminNode(reqCtx(false))
		require.NoError(t, err)
		require.Nil(t, findLabs(root.Children))
	})
}
