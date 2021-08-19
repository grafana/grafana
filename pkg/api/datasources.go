package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var datasourcesLogger = log.New("datasources")

func (hs *HTTPServer) GetDataSources(c *models.ReqContext) response.Response {
	query := models.GetDataSourcesQuery{OrgId: c.OrgId, DataSourceLimit: hs.Cfg.DataSourceLimit}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to query datasources", err)
	}

	result := make(dtos.DataSourceList, 0)
	for _, ds := range query.Result {
		dsItem := dtos.DataSourceListItemDTO{
			OrgId:     ds.OrgId,
			Id:        ds.Id,
			UID:       ds.Uid,
			Name:      ds.Name,
			Url:       ds.Url,
			Type:      ds.Type,
			TypeName:  ds.Type,
			Access:    ds.Access,
			Password:  ds.Password,
			Database:  ds.Database,
			User:      ds.User,
			BasicAuth: ds.BasicAuth,
			IsDefault: ds.IsDefault,
			JsonData:  ds.JsonData,
			ReadOnly:  ds.ReadOnly,
		}

		if plugin := hs.PluginManager.GetDataSource(ds.Type); plugin != nil {
			dsItem.TypeLogoUrl = plugin.Info.Logos.Small
			dsItem.TypeName = plugin.Name
		} else {
			dsItem.TypeLogoUrl = "public/img/icn-datasource.svg"
		}

		result = append(result, dsItem)
	}

	sort.Sort(result)

	return response.JSON(200, &result)
}

func GetDataSourceById(c *models.ReqContext) response.Response {
	query := models.GetDataSourceQuery{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		if errors.Is(err, models.ErrDataSourceIdentifierNotSet) {
			return response.Error(400, "Datasource id is missing", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := convertModelToDtos(ds)

	return response.JSON(200, &dtos)
}

func (hs *HTTPServer) DeleteDataSourceById(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return response.Error(400, "Missing valid datasource id", nil)
	}

	ds, err := getRawDataSourceById(id, c.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(400, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return response.Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceCommand{ID: id, OrgID: c.OrgId}

	err = bus.Dispatch(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, ds.Uid)

	return response.Success("Data source deleted")
}

// GET /api/datasources/uid/:uid
func GetDataSourceByUID(c *models.ReqContext) response.Response {
	ds, err := getRawDataSourceByUID(c.Params(":uid"), c.OrgId)

	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	dtos := convertModelToDtos(ds)
	return response.JSON(200, &dtos)
}

// DELETE /api/datasources/uid/:uid
func (hs *HTTPServer) DeleteDataSourceByUID(c *models.ReqContext) response.Response {
	uid := c.Params(":uid")

	if uid == "" {
		return response.Error(400, "Missing datasource uid", nil)
	}

	ds, err := getRawDataSourceByUID(uid, c.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(400, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return response.Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceCommand{UID: uid, OrgID: c.OrgId}

	err = bus.Dispatch(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, ds.Uid)

	return response.Success("Data source deleted")
}

func (hs *HTTPServer) DeleteDataSourceByName(c *models.ReqContext) response.Response {
	name := c.Params(":name")

	if name == "" {
		return response.Error(400, "Missing valid datasource name", nil)
	}

	getCmd := &models.GetDataSourceQuery{Name: name, OrgId: c.OrgId}
	if err := bus.Dispatch(getCmd); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to delete datasource", err)
	}

	if getCmd.Result.ReadOnly {
		return response.Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceCommand{Name: name, OrgID: c.OrgId}
	err := bus.Dispatch(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, getCmd.Result.Uid)

	return response.JSON(200, util.DynMap{
		"message": "Data source deleted",
		"id":      getCmd.Result.Id,
	})
}

func validateURL(tp string, u string) response.Response {
	if u != "" {
		if _, err := datasource.ValidateURL(tp, u); err != nil {
			datasourcesLogger.Error("Received invalid data source URL as part of data source command",
				"url", u)
			return response.Error(400, fmt.Sprintf("Validation error, invalid URL: %q", u), err)
		}
	}

	return nil
}

func AddDataSource(c *models.ReqContext, cmd models.AddDataSourceCommand) response.Response {
	datasourcesLogger.Debug("Received command to add data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
		return resp
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrDataSourceNameExists) || errors.Is(err, models.ErrDataSourceUidExists) {
			return response.Error(409, err.Error(), err)
		}

		return response.Error(500, "Failed to add datasource", err)
	}

	ds := convertModelToDtos(cmd.Result)
	return response.JSON(200, util.DynMap{
		"message":    "Datasource added",
		"id":         cmd.Result.Id,
		"name":       cmd.Result.Name,
		"datasource": ds,
	})
}

func (hs *HTTPServer) UpdateDataSource(c *models.ReqContext, cmd models.UpdateDataSourceCommand) response.Response {
	datasourcesLogger.Debug("Received command to update data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":id")
	if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
		return resp
	}

	err := fillWithSecureJSONData(&cmd)
	if err != nil {
		return response.Error(500, "Failed to update datasource", err)
	}

	err = bus.Dispatch(&cmd)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceUpdatingOldVersion) {
			return response.Error(409, "Datasource has already been updated by someone else. Please reload and try again", err)
		}
		return response.Error(500, "Failed to update datasource", err)
	}

	query := models.GetDataSourceQuery{
		Id:    cmd.Id,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasource", err)
	}

	datasourceDTO := convertModelToDtos(query.Result)

	hs.Live.HandleDatasourceUpdate(c.OrgId, datasourceDTO.UID)

	return response.JSON(200, util.DynMap{
		"message":    "Datasource updated",
		"id":         cmd.Id,
		"name":       cmd.Name,
		"datasource": datasourceDTO,
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
	query := models.GetDataSourceQuery{
		Id:    id,
		OrgId: orgID,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

func getRawDataSourceByUID(uid string, orgID int64) (*models.DataSource, error) {
	query := models.GetDataSourceQuery{
		Uid:   uid,
		OrgId: orgID,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// Get /api/datasources/name/:name
func GetDataSourceByName(c *models.ReqContext) response.Response {
	query := models.GetDataSourceQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	dtos := convertModelToDtos(query.Result)
	return response.JSON(200, &dtos)
}

// Get /api/datasources/id/:name
func GetDataSourceIdByName(c *models.ReqContext) response.Response {
	query := models.GetDataSourceQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := dtos.AnyId{
		Id: ds.Id,
	}

	return response.JSON(200, &dtos)
}

// /api/datasources/:id/resources/*
func (hs *HTTPServer) CallDatasourceResource(c *models.ReqContext) {
	datasourceID := c.ParamsInt64(":id")
	ds, err := hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			c.JsonApiErr(403, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	// find plugin
	plugin := hs.PluginManager.GetDataSource(ds.Type)
	if plugin == nil {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	dsInstanceSettings, err := adapters.ModelToInstanceSettings(ds)
	if err != nil {
		c.JsonApiErr(500, "Unable to process datasource instance model", err)
	}

	pCtx := backend.PluginContext{
		User:                       adapters.BackendUserFromSignedInUser(c.SignedInUser),
		OrgID:                      c.OrgId,
		PluginID:                   plugin.Id,
		DataSourceInstanceSettings: dsInstanceSettings,
	}
	hs.BackendPluginManager.CallResource(pCtx, c, c.Params("*"))
}

func convertModelToDtos(ds *models.DataSource) dtos.DataSource {
	dto := dtos.DataSource{
		Id:                ds.Id,
		UID:               ds.Uid,
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
func (hs *HTTPServer) CheckDatasourceHealth(c *models.ReqContext) response.Response {
	datasourceID := c.ParamsInt64("id")

	ds, err := hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			return response.Error(403, "Access denied to datasource", err)
		}
		return response.Error(500, "Unable to load datasource metadata", err)
	}

	plugin := hs.PluginManager.GetDataSource(ds.Type)
	if plugin == nil {
		return response.Error(500, "Unable to find datasource plugin", err)
	}

	dsInstanceSettings, err := adapters.ModelToInstanceSettings(ds)
	if err != nil {
		return response.Error(500, "Unable to get datasource model", err)
	}
	pCtx := backend.PluginContext{
		User:                       adapters.BackendUserFromSignedInUser(c.SignedInUser),
		OrgID:                      c.OrgId,
		PluginID:                   plugin.Id,
		DataSourceInstanceSettings: dsInstanceSettings,
	}

	resp, err := hs.BackendPluginManager.CheckHealth(c.Req.Context(), pCtx)
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
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
			return response.Error(500, "Failed to unmarshal detailed response from backend plugin", err)
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backend.HealthStatusOk {
		return response.JSON(400, payload)
	}

	return response.JSON(200, payload)
}
