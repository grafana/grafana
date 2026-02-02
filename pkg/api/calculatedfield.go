/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by abhasin at 03/08/2021
 */

package api

import (
	"context"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) GetCalculatedField(c *contextmodel.ReqContext) response.Response {
	query := &models.GetCalculatedField{
		OrgId: c.OrgID,
	}
	data, err := hs.getCalculatedFieldData(c.Req.Context(), query)
	if err != nil {
		return hs.FailResponse(err)
	}

	result := make([]*dtos.CalculatedField, 0)
	for _, field := range data {
		result = append(result, fieldInJson(field))
	}
	return hs.SuccessResponse(result)
}

func (hs *HTTPServer) getCalculatedFieldData(ctx context.Context, query *models.GetCalculatedField) ([]*models.CalculatedField, error) {
	if err := hs.sqlStore.GetCalculatedField(ctx, query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func fieldInJson(report *models.CalculatedField) *dtos.CalculatedField {

	json := &dtos.CalculatedField{
		FormName:    report.FormName,
		Module:      report.Module,
		Name:        report.Name,
		SqlQuery:    report.SqlQuery,
		Aggregation: report.Aggregation,
	}

	return json
}
