package navtreeimpl

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestGetAdminNode_ProvisioningLink(t *testing.T) {
	newService := func(provisioningEnabled bool) ServiceImpl {
		cfg := setting.NewCfg()
		cfg.ProvisioningEnabled = provisioningEnabled

		lic := licensingtest.NewFakeLicensing()
		lic.On("FeatureEnabled", mock.Anything).Return(false)

		return ServiceImpl{
			cfg:           cfg,
			accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
			authnService:  &authntest.FakeService{ExpectedIdentity: &authn.Identity{}},
			license:       lic,
			features:      featuremgmt.WithFeatures(),
		}
	}

	newAdminReqCtx := func() *contextmodel.ReqContext {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleAdmin},
			IsSignedIn:   true,
			Context:      &web.Context{Req: httpReq},
		}
	}

	hasProvisioningLink := func(node *navtree.NavLink) bool {
		for _, section := range node.Children {
			for _, link := range section.Children {
				if link.Id == "provisioning" {
					return true
				}
			}
		}
		return false
	}

	t.Run("shows provisioning link when enabled", func(t *testing.T) {
		svc := newService(true)
		node, err := svc.getAdminNode(newAdminReqCtx())
		require.NoError(t, err)
		require.True(t, hasProvisioningLink(node))
	})

	t.Run("hides provisioning link when disabled", func(t *testing.T) {
		svc := newService(false)
		node, err := svc.getAdminNode(newAdminReqCtx())
		require.NoError(t, err)
		require.False(t, hasProvisioningLink(node))
	})
}

func TestBuildDashboardNavLinks(t *testing.T) {
	newService := func() ServiceImpl {
		return ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
			features:      featuremgmt.WithFeatures(),
		}
	}

	hasPlaylistLink := func(navLinks []*navtree.NavLink) bool {
		for _, link := range navLinks {
			if link.Id == "dashboards/playlists" {
				return true
			}
		}
		return false
	}

	t.Run("Should show Playlists link for an anonymous Viewer", func(t *testing.T) {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		reqCtx := &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				IsAnonymous: true,
				OrgRole:     org.RoleViewer,
			},
			IsSignedIn: false,
			Context:    &web.Context{Req: httpReq},
		}

		service := newService()
		navLinks := service.buildDashboardNavLinks(reqCtx)

		require.True(t, hasPlaylistLink(navLinks), "expected anonymous Viewer to see the Playlists nav link")
	})

	t.Run("Should not show Playlists link for an unauthenticated user", func(t *testing.T) {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		reqCtx := &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				IsAnonymous: false,
				OrgRole:     org.RoleViewer,
			},
			IsSignedIn: false,
			Context:    &web.Context{Req: httpReq},
		}

		service := newService()
		navLinks := service.buildDashboardNavLinks(reqCtx)

		require.False(t, hasPlaylistLink(navLinks), "expected unauthenticated user to not see the Playlists nav link")
	})
}
