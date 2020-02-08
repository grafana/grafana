package api

import (
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/util"
)

func GetDataSources(c *m.ReqContext) Response {
	query := m.GetDataSourcesQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Failed to query datasources", err)
	}

	result := make(dtos.DataSourceList, 0)
	for _, ds := range query.Result {
		dsItem := dtos.DataSourceListItemDTO{
			OrgId:     ds.OrgId,
			Id:        ds.Id,
			Name:      ds.Name,
			Url:       ds.Url,
			Type:      ds.Type,
			Access:    ds.Access,
			Password:  ds.Password,
			Database:  ds.Database,
			User:      ds.User,
			BasicAuth: ds.BasicAuth,
			IsDefault: ds.IsDefault,
			JsonData:  ds.JsonData,
			ReadOnly:  ds.ReadOnly,
		}

		if plugin, exists := plugins.DataSources[ds.Type]; exists {
			dsItem.TypeLogoUrl = plugin.Info.Logos.Small
		} else {
			dsItem.TypeLogoUrl = "public/img/icn-datasource.svg"
		}

		result = append(result, dsItem)
	}

	sort.Sort(result)

	return JSON(200, &result)
}

func GetDataSourceById(c *m.ReqContext) Response {
	query := m.GetDataSourceByIdQuery{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := convertModelToDtos(ds)

	return JSON(200, &dtos)
}

func DeleteDataSourceById(c *m.ReqContext) Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return Error(400, "Missing valid datasource id", nil)
	}

	ds, err := getRawDataSourceById(id, c.OrgId)
	if err != nil {
		return Error(400, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &m.DeleteDataSourceByIdCommand{Id: id, OrgId: c.OrgId}

	err = bus.Dispatch(cmd)
	if err != nil {
		return Error(500, "Failed to delete datasource", err)
	}

	return Success("Data source deleted")
}

func DeleteDataSourceByName(c *m.ReqContext) Response {
	name := c.Params(":name")

	if name == "" {
		return Error(400, "Missing valid datasource name", nil)
	}

	getCmd := &m.GetDataSourceByNameQuery{Name: name, OrgId: c.OrgId}
	if err := bus.Dispatch(getCmd); err != nil {
		if err == m.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to delete datasource", err)
	}

	if getCmd.Result.ReadOnly {
		return Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &m.DeleteDataSourceByNameCommand{Name: name, OrgId: c.OrgId}
	err := bus.Dispatch(cmd)
	if err != nil {
		return Error(500, "Failed to delete datasource", err)
	}

	return Success("Data source deleted")
}

func AddDataSource(c *m.ReqContext, cmd m.AddDataSourceCommand) Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrDataSourceNameExists {
			return Error(409, err.Error(), err)
		}

		return Error(500, "Failed to add datasource", err)
	}

	ds := convertModelToDtos(cmd.Result)
	return JSON(200, util.DynMap{
		"message":    "Datasource added",
		"id":         cmd.Result.Id,
		"name":       cmd.Result.Name,
		"datasource": ds,
	})
}

func UpdateDataSource(c *m.ReqContext, cmd m.UpdateDataSourceCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":id")

	err := fillWithSecureJSONData(&cmd)
	if err != nil {
		return Error(500, "Failed to update datasource", err)
	}

	err = bus.Dispatch(&cmd)
	if err != nil {
		if err == m.ErrDataSourceUpdatingOldVersion {
			return Error(500, "Failed to update datasource. Reload new version and try again", err)
		}
		return Error(500, "Failed to update datasource", err)
	}

	query := m.GetDataSourceByIdQuery{
		Id:    cmd.Id,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to query datasources", err)
	}

	dtos := convertModelToDtos(query.Result)

	return JSON(200, util.DynMap{
		"message":    "Datasource updated",
		"id":         cmd.Id,
		"name":       cmd.Name,
		"datasource": dtos,
	})
}

func fillWithSecureJSONData(cmd *m.UpdateDataSourceCommand) error {
	if len(cmd.SecureJsonData) == 0 {
		return nil
	}

	ds, err := getRawDataSourceById(cmd.Id, cmd.OrgId)
	if err != nil {
		return err
	}

	if ds.ReadOnly {
		return m.ErrDatasourceIsReadOnly
	}

	secureJSONData := ds.SecureJsonData.Decrypt()
	for k, v := range secureJSONData {

		if _, ok := cmd.SecureJsonData[k]; !ok {
			cmd.SecureJsonData[k] = v
		}
	}

	return nil
}

func getRawDataSourceById(id int64, orgID int64) (*m.DataSource, error) {
	query := m.GetDataSourceByIdQuery{
		Id:    id,
		OrgId: orgID,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// Get /api/datasources/name/:name
func GetDataSourceByName(c *m.ReqContext) Response {
	query := m.GetDataSourceByNameQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to query datasources", err)
	}

	dtos := convertModelToDtos(query.Result)
	return JSON(200, &dtos)
}

// Get /api/datasources/id/:name
func GetDataSourceIdByName(c *m.ReqContext) Response {
	query := m.GetDataSourceByNameQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := dtos.AnyId{
		Id: ds.Id,
	}

	return JSON(200, &dtos)
}

// /api/datasources/:id/resources/*
func (hs *HTTPServer) CallDatasourceResource(c *m.ReqContext) Response {
	datasourceID := c.ParamsInt64(":id")
	ds, err := hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if err == m.ErrDataSourceAccessDenied {
			return Error(403, "Access denied to datasource", err)
		}
		return Error(500, "Unable to load datasource meta data", err)
	}

	// find plugin
	plugin, ok := plugins.DataSources[ds.Type]
	if !ok {
		return Error(500, "Unable to find datasource plugin", err)
	}

	body, err := c.Req.Body().Bytes()
	if err != nil {
		return Error(500, "Failed to read request body", err)
	}
	req := backendplugin.CallResourceRequest{
		Config: backendplugin.PluginConfig{
			OrgID:    c.OrgId,
			PluginID: plugin.Id,
			Instance: &backendplugin.PluginInstance{
				ID:   ds.Id,
				Name: ds.Name,
				Type: ds.Type,
				URL:  ds.Url,
			},
		},
		Path:    c.Params("*"),
		Method:  c.Req.Method,
		URL:     c.Req.URL.String(),
		Headers: c.Req.Header.Clone(),
		Body:    body,
	}
	resp, err := hs.BackendPluginManager.CallResource(c.Req.Context(), req)
	if err != nil {
		return Error(500, "Failed to call datasource resource", err)
	}

	if resp.Status >= 400 {
		return Error(resp.Status, "", nil)
	}

	return &NormalResponse{
		body:   resp.Body,
		status: resp.Status,
		header: resp.Headers,
	}
}

func convertModelToDtos(ds *m.DataSource) dtos.DataSource {
	dto := dtos.DataSource{
		Id:                ds.Id,
		OrgId:             ds.OrgId,
		Name:              ds.Name,
		Url:               ds.Url,
		Type:              ds.Type,
		Access:            ds.Access,
		Password:          ds.Password,
		Database:          ds.Database,
		User:              ds.User,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          ds.JsonData,
		SecureJsonFields:  map[string]bool{},
		Version:           ds.Version,
		ReadOnly:          ds.ReadOnly,
	}

	for k, v := range ds.SecureJsonData {
		if len(v) > 0 {
			dto.SecureJsonFields[k] = true
		}
	}

	return dto
}
