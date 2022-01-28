package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	api "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/services"
	"github.com/grafana/grafana/pkg/web"
)

type ContactPointServer struct {
	service services.ContactPointService
}

func (s *ContactPointServer) RouteGetContactPoint(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_VIEWER) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	templates, err := s.service.GetContactPoints(c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, templates)
}

func (s *ContactPointServer) RouteCreateContactPoint(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	contactPoint := services.EmbeddedContactPoint{}
	if err := web.Bind(c.Req, &contactPoint); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	contactPoint, err := s.service.CreateContactPoint(c.OrgId, contactPoint)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, contactPoint)
}

func (s *ContactPointServer) RouteUpdateContactPoint(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	contactPoint := services.EmbeddedContactPoint{}
	if err := web.Bind(c.Req, &contactPoint); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	contactPoint, err := s.service.UpdateContactPoint(c.OrgId, contactPoint)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, contactPoint)
}

func (s *ContactPointServer) RouteDeleteContactPoint(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	contactPoint := services.EmbeddedContactPoint{}
	if err := web.Bind(c.Req, &contactPoint); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	err := s.service.DeleteContactPoint(c.OrgId, contactPoint.UID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, "")
}
