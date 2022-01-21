package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	api "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/services"
	"github.com/grafana/grafana/pkg/web"
)

type RuleServer struct {
	service services.RuleService
}

func (s *RuleServer) RouteGetRule(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_VIEWER) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	alertRule, err := s.service.GetRule(c.OrgId, web.Params(c.Req)[":uid"])
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, alertRule)
}

func (s *RuleServer) RouteCreateRule(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	alertRule := models.AlertRule{}
	if err := web.Bind(c.Req, &alertRule); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	err := s.service.CreateRule(alertRule)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, alertRule)
}

func (s *RuleServer) RouteUpdateRule(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	alertRule := models.AlertRule{}
	if err := web.Bind(c.Req, &alertRule); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	err := s.service.UpdateRule(alertRule)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, alertRule)
}

func (s *RuleServer) RouteDeleteRule(c *api.ReqContext) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	err := s.service.DeleteRule(c.OrgId, web.Params(c.Req)[":uid"])
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, "")
}
