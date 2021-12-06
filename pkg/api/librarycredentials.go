package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
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
