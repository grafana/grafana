package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetLibraryCredentials(c *models.ReqContext) response.Response {
	query := models.GetLibraryCredentialsQuery{OrgId: c.OrgId}

	if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to query library credentials", err)
	}

	result := []dtos.LibraryCredentialDto{}
	for _, ds := range query.Result {
		dsItem := dtos.LibraryCredentialDto{
			OrgId:    ds.OrgId,
			Id:       ds.Id,
			UID:      ds.Uid,
			Name:     ds.Name,
			Type:     ds.Type,
			JsonData: ds.JsonData,
			ReadOnly: ds.ReadOnly,
		}

		result = append(result, dsItem)
	}

	return response.JSON(200, &result)
}

func (hs *HTTPServer) AddLibraryCredential(c *models.ReqContext) response.Response {
	cmd := models.AddLibraryCredentialCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId

	if err := bus.DispatchCtx(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrLibraryCredentialNameExists) || errors.Is(err, models.ErrDataSourceFailedGenerateUniqueUid) {
			return response.Error(409, err.Error(), err)
		}

		return response.Error(500, "Failed to add library credential", err)
	}

	credential := dtos.LibraryCredentialDto{
		OrgId:    cmd.Result.OrgId,
		Id:       cmd.Result.Id,
		UID:      cmd.Result.Uid,
		Name:     cmd.Result.Name,
		Type:     cmd.Result.Type,
		JsonData: cmd.Result.JsonData,
		ReadOnly: cmd.Result.ReadOnly,
	}
	return response.JSON(200, util.DynMap{
		"message":    "Library Credential added",
		"id":         cmd.Result.Id,
		"name":       cmd.Result.Name,
		"credential": credential,
	})
}

func (hs *HTTPServer) UpdateLibraryCredential(c *models.ReqContext) response.Response {
	cmd := models.UpdateLibraryCredentialCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId

	if err := bus.DispatchCtx(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to add library credential", err)
	}

	credential := dtos.LibraryCredentialDto{
		OrgId:    cmd.Result.OrgId,
		Id:       cmd.Result.Id,
		UID:      cmd.Result.Uid,
		Name:     cmd.Result.Name,
		Type:     cmd.Result.Type,
		JsonData: cmd.Result.JsonData,
		ReadOnly: cmd.Result.ReadOnly,
	}
	return response.JSON(200, util.DynMap{
		"message":    "Library Credential added",
		"id":         cmd.Result.Id,
		"name":       cmd.Result.Name,
		"credential": credential,
	})
}
