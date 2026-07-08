package navtreeimpl

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
	starapi "github.com/grafana/grafana/pkg/services/star/api"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestBuildStarredItemsNavLinks(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{
			UserID: 1,
			OrgID:  1,
		},
		Context: &web.Context{Req: httpReq},
	}

	t.Run("Should return empty list when there are no starred dashboards", func(t *testing.T) {
		starClient := starapi.NewMockK8sClients(t)
		starClient.On("GetStars", reqCtx).Return([]string{}, nil)

		service := ServiceImpl{
			starClient: starClient,
		}

		navLinks, err := service.buildStarredItemsNavLinks(reqCtx)
		require.NoError(t, err)
		require.Empty(t, navLinks)
	})

	t.Run("Should return nav links for starred dashboards", func(t *testing.T) {
		starClient := starapi.NewMockK8sClients(t)
		starClient.On("GetStars", reqCtx).Return([]string{"dashboard1", "dashboard2"}, nil)

		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("SearchDashboards", mock.Anything, mock.Anything).Return(model.HitList{
			{
				UID:   "dashboard1",
				Title: "Dashboard 1",
				URL:   "/d/dashboard1/",
			},
			{
				UID:   "dashboard2",
				Title: "Dashboard 2",
				URL:   "/d/dashboard2/",
			},
		}, nil)

		service := ServiceImpl{
			starClient:       starClient,
			dashboardService: dashboardService,
		}

		navLinks, err := service.buildStarredItemsNavLinks(reqCtx)
		require.NoError(t, err)
		require.Len(t, navLinks, 2)

		require.Equal(t, "starred/dashboard1", navLinks[0].Id)
		require.Equal(t, "Dashboard 1", navLinks[0].Text)
		require.Equal(t, "/d/dashboard1/", navLinks[0].Url)
		require.Equal(t, "starred/dashboard2", navLinks[1].Id)
		require.Equal(t, "Dashboard 2", navLinks[1].Text)
		require.Equal(t, "/d/dashboard2/", navLinks[1].Url)
	})

	t.Run("Should limit to 50 starred dashboards", func(t *testing.T) {
		uids := make([]string, 60)
		dashboardList := make(model.HitList, 60)
		for i := 0; i < 60; i++ {
			uids[i] = fmt.Sprintf("dashboard%d", i)
			dashboardList[i] = &model.Hit{
				UID:   fmt.Sprintf("dashboard%d", i),
				Title: fmt.Sprintf("Dashboard %d", i),
				URL:   fmt.Sprintf("/d/dashboard%d/", i),
			}
		}

		starClient := starapi.NewMockK8sClients(t)
		starClient.On("GetStars", reqCtx).Return(uids, nil)

		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("SearchDashboards", mock.Anything, mock.Anything).Return(dashboardList, nil)

		service := ServiceImpl{
			starClient:       starClient,
			dashboardService: dashboardService,
		}

		navLinks, err := service.buildStarredItemsNavLinks(reqCtx)
		require.NoError(t, err)
		require.Len(t, navLinks, 50)
	})

	t.Run("Should sort dashboards by title", func(t *testing.T) {
		starClient := starapi.NewMockK8sClients(t)
		starClient.On("GetStars", reqCtx).Return([]string{"dashboard1", "dashboard2", "dashboard3"}, nil)

		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("SearchDashboards", mock.Anything, mock.Anything).Return(model.HitList{
			{
				UID:   "dashboard1",
				Title: "C Dashboard",
				URL:   "/d/dashboard1/",
			},
			{
				UID:   "dashboard2",
				Title: "A Dashboard",
				URL:   "/d/dashboard2/",
			},
			{
				UID:   "dashboard3",
				Title: "B Dashboard",
				URL:   "/d/dashboard3/",
			},
		}, nil)

		service := ServiceImpl{
			starClient:       starClient,
			dashboardService: dashboardService,
		}

		navLinks, err := service.buildStarredItemsNavLinks(reqCtx)
		require.NoError(t, err)
		require.Len(t, navLinks, 3)

		require.Equal(t, "A Dashboard", navLinks[0].Text)
		require.Equal(t, "B Dashboard", navLinks[1].Text)
		require.Equal(t, "C Dashboard", navLinks[2].Text)
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

func TestBuildLabsNavLink(t *testing.T) {
	newService := func() ServiceImpl {
		return ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		}
	}

	newReqContext := func(permissions []accesscontrol.Permission) *contextmodel.ReqContext {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				UserID: 1,
				OrgID:  1,
				Permissions: map[int64]map[string][]string{
					1: accesscontrol.GroupScopesByActionContext(context.Background(), permissions),
				},
			},
			IsSignedIn: true,
			Context:    &web.Context{Req: httpReq},
		}
	}

	t.Run("shows Labs for users with feature management read access", func(t *testing.T) {
		service := newService()
		link := service.buildLabsNavLink(newReqContext([]accesscontrol.Permission{
			{Action: accesscontrol.ActionFeatureManagementRead},
		}))

		require.NotNil(t, link)
		require.Equal(t, navtree.NavIDLabs, link.Id)
		require.Equal(t, "/labs", link.Url)
		require.Len(t, link.Children, 1)
		require.Equal(t, navtree.NavIDLabsFeatureFlags, link.Children[0].Id)
		require.Equal(t, "/labs/feature-flags", link.Children[0].Url)
	})

	t.Run("hides Labs for users without feature management read access", func(t *testing.T) {
		service := newService()
		link := service.buildLabsNavLink(newReqContext([]accesscontrol.Permission{
			{Action: "wrong"},
		}))

		require.Nil(t, link)
	})
}
