package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	domain "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ProvisioningSrv struct {
	log                 log.Logger
	ContactpointService ContactpointService
}

type ContactpointService interface {
	GetContactPoints(orgID int64) ([]domain.EmbeddedContactPoint, error)
	CreateContactPoint(orgID int64, contactPoint domain.EmbeddedContactPoint) (domain.EmbeddedContactPoint, error)
	UpdateContactPoint(orgID int64, contactPoint domain.EmbeddedContactPoint) error
	DeleteContactPoint(orgID int64, uid string) error
}

func (srv *ProvisioningSrv) RouteGetContactpoints(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, "")
}

func (srv *ProvisioningSrv) RoutePostContactpoint(c *models.ReqContext, tree apimodels.Route) response.Response {
	return response.JSON(http.StatusOK, "")
}
