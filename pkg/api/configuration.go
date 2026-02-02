/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by kmejdi at 29/7/2021
 */

package api

import (
	"net/http"
	"regexp"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetCustomConfiguration(c *contextmodel.ReqContext) response.Response {
	query := &models.GetCustomConfiguration{
		OrgId: c.OrgID,
	}
	if err := hs.sqlStore.GetCustomConfiguration(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	result := dtos.CustomConfiguration{
		DocLink:       query.Result.DocLink,
		SupportLink:   query.Result.SupportLink,
		CommunityLink: query.Result.CommunityLink,
		VideoLink:     query.Result.VideoLink,
		QueryType:     query.Result.QueryType,
	}
	return hs.SuccessResponse(result)
}
func (hs *HTTPServer) AddCustomConfiguration(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.CustomConfiguration{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data when adding custom configuration", err)
	}
	if !ValidateLink(cmd.DocLink) || !ValidateLink(cmd.SupportLink) || !ValidateLink(cmd.CommunityLink) || !ValidateLink(cmd.VideoLink) {
		return response.Error(http.StatusBadRequest, "Invalid Url", nil)
	}
	query := &models.SetCustomConfiguration{
		OrgId: c.OrgID,
		Data: models.CustomConfiguration{
			OrgID:         c.OrgID,
			DocLink:       cmd.DocLink,
			SupportLink:   cmd.SupportLink,
			CommunityLink: cmd.CommunityLink,
			VideoLink:     cmd.VideoLink,
			QueryType:     cmd.QueryType,
		},
	}

	if err := hs.sqlStore.SetCustomConfiguration(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return response.Success("Configuration updated")
}

func ValidateLink(url string) bool {
	if len(url) == 0 {
		return true
	}
	re := regexp.MustCompile(`^(http|https):\/\/[^ "]+$`)
	return re.MatchString(url)
}

func (hs *HTTPServer) RefreshCustomConfiguration(c *contextmodel.ReqContext) response.Response {
	query := &models.RefreshCustomConfiguration{
		OrgId: c.OrgID,
	}
	if err := hs.sqlStore.ResetCustomConfiguration(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return response.Success("Configuration is set to default")
}
