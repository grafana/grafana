/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by ateli at 10/02/2022
 */

package api

import (
	"errors"
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bhdcodes"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetAllCalcFields(c *contextmodel.ReqContext) response.Response {

	query := models.GetCalculatedFields{
		OrgId: c.OrgID,
	}

	if err := hs.sqlStore.GetCalculatedFields(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get Calculated Fields", err)
	}
	return response.JSON(200, query.Result)
}

func (hs *HTTPServer) CreateNewCalcFields(c *contextmodel.ReqContext) response.Response {
	cmd := models.CreateCalcFieldCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload while creating calculated field", err)
	}

	cmd.OrgId = c.OrgID
	if err := hs.sqlStore.CheckForField(c.Req.Context(), cmd.Name); err != nil {
		if errors.Is(err, models.DuplicateFieldName) {
			return response.Error(409, "Calculated field name is already taken. Please provide a different name.", err)
		}
		return response.Error(500, "Failed to create calculated field", err)
	}
	if err := hs.sqlStore.CreateCalculatedField(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to create calculated field", err)
	}
	//BMC code change
	return response.JSON(200, &util.DynMap{"message": "New Field Created Successfully", "bhdCode": bhdcodes.CalcFieldCreatedSuccess})
}

func (hs *HTTPServer) DeleteCalcFieldsById(c *contextmodel.ReqContext) response.Response {
	cmd := models.DeleteCalcFieldsByIds{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload while deleting calculated field", err)
	}

	cmd.OrgId = c.OrgID

	if err1 := hs.sqlStore.GetDashboardsToCalcDelete(c.Req.Context(), &cmd); err1 != nil {
		return response.Error(500, "Failed to delete field from Dashboard(s)", err1)
	}
	if err := hs.sqlStore.DeletelatedFields(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to delete calculated field", err)
	}
	return response.Success("Field(s) Deleted Successfully")
}

func (hs *HTTPServer) ModifyCalcFieldsById(c *contextmodel.ReqContext) response.Response {
	cmd := models.ModifyCalcFieldCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload while modifying calculated field", err)
	}

	cmd.OrgId = c.OrgID
	if err := hs.sqlStore.ModifyCalcFields(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to modify calculated field", err)
	}
	if err1 := hs.sqlStore.GetDashboardsToCalcUpdate(c.Req.Context(), cmd.Name, cmd.OrgId, cmd.Module, cmd.SqlQuery, cmd.Name); err1 != nil {
		return response.Error(500, "Failed to Update Dashboards", err1)
	}
	return response.Success("Fields Modified Successfully")
}
