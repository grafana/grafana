package api

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/datasource/wrapper"
	"github.com/grafana/grafana/pkg/util"
)

var datasourcesLogger = log.New("datasources")

func GetDataSources(c *models.ReqContext) Response {
	query := models.GetDataSourcesQuery{OrgId: c.OrgId}

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

func GetDataSourceById(c *models.ReqContext) Response {
	query := models.GetDataSourceByIdQuery{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := convertModelToDtos(ds)

	return JSON(200, &dtos)
}

func DeleteDataSourceById(c *models.ReqContext) Response {
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

	cmd := &models.DeleteDataSourceByIdCommand{Id: id, OrgId: c.OrgId}

	err = bus.Dispatch(cmd)
	if err != nil {
		return Error(500, "Failed to delete datasource", err)
	}

	return Success("Data source deleted")
}

func DeleteDataSourceByName(c *models.ReqContext) Response {
	name := c.Params(":name")

	if name == "" {
		return Error(400, "Missing valid datasource name", nil)
	}

	getCmd := &models.GetDataSourceByNameQuery{Name: name, OrgId: c.OrgId}
	if err := bus.Dispatch(getCmd); err != nil {
		if err == models.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to delete datasource", err)
	}

	if getCmd.Result.ReadOnly {
		return Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceByNameCommand{Name: name, OrgId: c.OrgId}
	err := bus.Dispatch(cmd)
	if err != nil {
		return Error(500, "Failed to delete datasource", err)
	}

	return Success("Data source deleted")
}

func validateURL(tp string, u string) Response {
	if u != "" {
		if _, err := datasource.ValidateURL(tp, u); err != nil {
			datasourcesLogger.Error("Received invalid data source URL as part of data source command",
				"url", u)
			return Error(400, fmt.Sprintf("Validation error, invalid URL: %q", u), err)
		}
	}

	return nil
}

func AddDataSource(c *models.ReqContext, cmd models.AddDataSourceCommand) Response {
	datasourcesLogger.Debug("Received command to add data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
		return resp
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrDataSourceNameExists || err == models.ErrDataSourceUidExists {
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

func UpdateDataSource(c *models.ReqContext, cmd models.UpdateDataSourceCommand) Response {
	datasourcesLogger.Debug("Received command to update data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":id")
	if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
		return resp
	}

	err := fillWithSecureJSONData(&cmd)
	if err != nil {
		return Error(500, "Failed to update datasource", err)
	}

	err = bus.Dispatch(&cmd)
	if err != nil {
		if err == models.ErrDataSourceUpdatingOldVersion {
			return Error(500, "Failed to update datasource. Reload new version and try again", err)
		}
		return Error(500, "Failed to update datasource", err)
	}

	query := models.GetDataSourceByIdQuery{
		Id:    cmd.Id,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrDataSourceNotFound {
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

func fillWithSecureJSONData(cmd *models.UpdateDataSourceCommand) error {
	if len(cmd.SecureJsonData) == 0 {
		return nil
	}

	ds, err := getRawDataSourceById(cmd.Id, cmd.OrgId)
	if err != nil {
		return err
	}

	if ds.ReadOnly {
		return models.ErrDatasourceIsReadOnly
	}

	secureJSONData := ds.SecureJsonData.Decrypt()
	for k, v := range secureJSONData {

		if _, ok := cmd.SecureJsonData[k]; !ok {
			cmd.SecureJsonData[k] = v
		}
	}

	return nil
}

func getRawDataSourceById(id int64, orgID int64) (*models.DataSource, error) {
	query := models.GetDataSourceByIdQuery{
		Id:    id,
		OrgId: orgID,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// Get /api/datasources/name/:name
func GetDataSourceByName(c *models.ReqContext) Response {
	query := models.GetDataSourceByNameQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrDataSourceNotFound {
			return Error(404, "Data source not found", nil)
		}
		return Error(500, "Failed to query datasources", err)
	}

	dtos := convertModelToDtos(query.Result)
	return JSON(200, &dtos)
}

// Get /api/datasources/id/:name
func GetDataSourceIdByName(c *models.ReqContext) Response {
	query := models.GetDataSourceByNameQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrDataSourceNotFound {
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
func (hs *HTTPServer) CallDatasourceResource(c *models.ReqContext) {
	datasourceID := c.ParamsInt64(":id")
	ds, err := hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if err == models.ErrDataSourceAccessDenied {
			c.JsonApiErr(403, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	// find plugin
	plugin, ok := plugins.DataSources[ds.Type]
	if !ok {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	dsInstanceSettings, err := wrapper.ModelToInstanceSettings(ds)
	if err != nil {
		c.JsonApiErr(500, "Unable to process datasource instance model", err)
	}

	pCtx := backend.PluginContext{
		User:                       wrapper.BackendUserFromSignedInUser(c.SignedInUser),
		OrgID:                      c.OrgId,
		PluginID:                   plugin.Id,
		DataSourceInstanceSettings: dsInstanceSettings,
	}
	hs.BackendPluginManager.CallResource(pCtx, c, c.Params("*"))
}

func convertModelToDtos(ds *models.DataSource) dtos.DataSource {
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

// CheckDatasourceHealth sends a health check request to the plugin datasource
// /api/datasource/:id/health
func (hs *HTTPServer) CheckDatasourceHealth(c *models.ReqContext) {
	datasourceID := c.ParamsInt64("id")

	ds, err := hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if err == models.ErrDataSourceAccessDenied {
			c.JsonApiErr(403, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(500, "Unable to load datasource metadata", err)
		return
	}

	plugin, ok := hs.PluginManager.GetDatasource(ds.Type)
	if !ok {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	dsInstanceSettings, err := wrapper.ModelToInstanceSettings(ds)
	if err != nil {
		c.JsonApiErr(500, "Unable to get datasource model", err)
	}
	pCtx := backend.PluginContext{
		User:                       wrapper.BackendUserFromSignedInUser(c.SignedInUser),
		OrgID:                      c.OrgId,
		PluginID:                   plugin.Id,
		DataSourceInstanceSettings: dsInstanceSettings,
	}

	resp, err := hs.BackendPluginManager.CheckHealth(c.Req.Context(), pCtx)
	if err != nil {
		if err == backendplugin.ErrPluginNotRegistered {
			c.JsonApiErr(404, "Plugin not found", err)
			return
		}

		// Return status unknown instead?
		if err == backendplugin.ErrDiagnosticsNotSupported {
			c.JsonApiErr(404, "Health check not implemented", err)
			return
		}

		// Return status unknown or error instead?
		if err == backendplugin.ErrHealthCheckFailed {
			c.JsonApiErr(500, "Plugin health check failed", err)
			return
		}

		c.JsonApiErr(500, "Plugin healthcheck returned an unknown error", err)
		return
	}

	payload := map[string]interface{}{
		"status":  resp.Status.String(),
		"message": resp.Message,
	}

	// Unmarshal JSONDetails if it's not empty.
	if len(resp.JSONDetails) > 0 {
		var jsonDetails map[string]interface{}
		err = json.Unmarshal(resp.JSONDetails, &jsonDetails)
		if err != nil {
			c.JsonApiErr(500, "Failed to unmarshal detailed response from backend plugin", err)
			return
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backendplugin.HealthStatusOk {
		c.JSON(503, payload)
		return
	}

	c.JSON(200, payload)
}
