package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetLibraryCredentials(c *models.ReqContext) response.Response {
	query := models.GetLibraryCredentialsQuery{OrgId: c.OrgId}

	if err := hs.LibraryCredentialService.GetLibraryCredentials(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to query library credentials", err)
	}

	result := []dtos.LibraryCredentialDto{}
	for _, lc := range query.Result {
		lcItem := convertLibraryCredentialModelToDto(lc)
		result = append(result, lcItem)
	}

	return response.JSON(200, &result)
}

func (hs *HTTPServer) AddLibraryCredential(c *models.ReqContext) response.Response {
	cmd := models.AddLibraryCredentialCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId

	if err := hs.LibraryCredentialService.AddLibraryCredential(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrLibraryCredentialNameExists) || errors.Is(err, models.ErrDataSourceFailedGenerateUniqueUid) {
			return response.Error(409, err.Error(), err)
		}

		return response.Error(500, "Failed to add library credential", err)
	}

	credential := convertLibraryCredentialModelToDto(cmd.Result)
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
	cmd.Id = c.ParamsInt64(":id")

	if err := hs.LibraryCredentialService.UpdateLibraryCredential(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to add library credential", err)
	}

	credential := convertLibraryCredentialModelToDto(cmd.Result)
	return response.JSON(200, util.DynMap{
		"message":    "Library Credential added",
		"id":         cmd.Result.Id,
		"name":       cmd.Result.Name,
		"credential": credential,
	})
}

func (hs *HTTPServer) DeleteLibraryCredentialById(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return response.Error(400, "Missing valid library credentials id", nil)
	}

	// TODO: should load lib cred by id and check that it's not readonly before deleting it

	cmd := &models.DeleteLibraryCredentialCommand{Id: id, OrgId: c.OrgId}

	if err := hs.LibraryCredentialService.DeleteLibraryCredential(c.Req.Context(), cmd); err != nil {
		return response.Error(500, "Failed to delete library credential", err)
	}

	return response.Success("Library credential deleted")
}

func convertLibraryCredentialModelToDto(ds *models.LibraryCredential) dtos.LibraryCredentialDto {
	dto := dtos.LibraryCredentialDto{
		OrgId:            ds.OrgId,
		Id:               ds.Id,
		UID:              ds.Uid,
		Name:             ds.Name,
		Type:             ds.Type,
		JsonData:         ds.JsonData,
		ReadOnly:         ds.ReadOnly,
		SecureJsonFields: map[string]bool{},
	}

	for k, v := range ds.SecureJsonData {
		if len(v) > 0 {
			dto.SecureJsonFields[k] = true
		}
	}

	return dto
}
