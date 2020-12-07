package librarypanels

import (
	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type LibraryPanelApi interface {
	registerAPIEndpoints()
	addLibraryPanelEndpoint(c *models.ReqContext, cmd addLibraryPanelCommand) api.Response
}

type LibraryPanelApiImpl struct {
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	repository    LibraryPanelRepository
}

func NewApi(routeRegister routing.RouteRegister, cfg *setting.Cfg, repository LibraryPanelRepository) LibraryPanelApi {
	impl := &LibraryPanelApiImpl{
		Cfg:           cfg,
		RouteRegister: routeRegister,
		repository:    repository,
	}

	return impl
}

func (lpa *LibraryPanelApiImpl) registerAPIEndpoints() {
	if !lpa.Cfg.IsPanelLibraryEnabled() {
		return
	}

	lpa.RouteRegister.Group("/api/library-panels", func(libraryPanels routing.RouteRegister) {
		libraryPanels.Post("/", middleware.ReqSignedIn, binding.Bind(addLibraryPanelCommand{}), api.Wrap(lpa.addLibraryPanelEndpoint))
	})
}

// addLibraryPanelEndpoint handles POST /api/library-panels.
func (lpa *LibraryPanelApiImpl) addLibraryPanelEndpoint(c *models.ReqContext, cmd addLibraryPanelCommand) api.Response {
	cmd.OrgId = c.SignedInUser.OrgId
	cmd.SignedInUser = c.SignedInUser

	if err := lpa.repository.addLibraryPanel(&cmd); err != nil {
		return api.Error(500, "Failed to create library panel", err)
	}

	return api.JSON(200, util.DynMap{"id": cmd.Result.Id})
}
