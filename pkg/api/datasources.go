package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/permissions"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var datasourcesLogger = log.New("datasources")

func (hs *HTTPServer) GetDataSources(c *models.ReqContext) response.Response {
	query := models.GetDataSourcesQuery{OrgId: c.OrgId, DataSourceLimit: hs.Cfg.DataSourceLimit}

	if err := hs.DataSourcesService.GetDataSources(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to query datasources", err)
	}

	filtered, err := hs.filterDatasourcesByQueryPermission(c.Req.Context(), c.SignedInUser, query.Result)
	if err != nil {
		return response.Error(500, "Failed to query datasources", err)
	}

	result := make(dtos.DataSourceList, 0)
	for _, ds := range filtered {
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

		if plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type); exists {
			dsItem.TypeLogoUrl = plugin.Info.Logos.Small
			dsItem.TypeName = plugin.Name
		} else {
			dsItem.TypeLogoUrl = "public/img/icn-datasource.svg"
		}

		result = append(result, dsItem)
	}

	sort.Sort(result)

	return response.JSON(http.StatusOK, &result)
}

// GET /api/datasources/:id
func (hs *HTTPServer) GetDataSourceById(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	query := models.GetDataSourceQuery{
		Id:    id,
		OrgId: c.OrgId,
	}

	if err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		if errors.Is(err, models.ErrDataSourceIdentifierNotSet) {
			return response.Error(400, "Datasource id is missing", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	filtered, err := hs.filterDatasourcesByQueryPermission(c.Req.Context(), c.SignedInUser, []*models.DataSource{query.Result})
	if err != nil || len(filtered) != 1 {
		return response.Error(404, "Data source not found", err)
	}

	dto := hs.convertModelToDtos(c.Req.Context(), filtered[0])

	// Add accesscontrol metadata
	dto.AccessControl = hs.getAccessControlMetadata(c, c.OrgId, datasources.ScopePrefix, dto.UID)

	return response.JSON(http.StatusOK, &dto)
}

// DELETE /api/datasources/:id
func (hs *HTTPServer) DeleteDataSourceById(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if id <= 0 {
		return response.Error(400, "Missing valid datasource id", nil)
	}

	ds, err := hs.getRawDataSourceById(c.Req.Context(), id, c.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(400, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return response.Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceCommand{ID: id, OrgID: c.OrgId, Name: ds.Name}

	err = hs.DataSourcesService.DeleteDataSource(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(500, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, ds.Uid)

	return response.Success("Data source deleted")
}

// GET /api/datasources/uid/:uid
func (hs *HTTPServer) GetDataSourceByUID(c *models.ReqContext) response.Response {
	ds, err := hs.getRawDataSourceByUID(c.Req.Context(), web.Params(c.Req)[":uid"], c.OrgId)

	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query datasource", err)
	}

	filtered, err := hs.filterDatasourcesByQueryPermission(c.Req.Context(), c.SignedInUser, []*models.DataSource{ds})
	if err != nil || len(filtered) != 1 {
		return response.Error(404, "Data source not found", err)
	}

	dto := hs.convertModelToDtos(c.Req.Context(), filtered[0])

	// Add accesscontrol metadata
	dto.AccessControl = hs.getAccessControlMetadata(c, c.OrgId, datasources.ScopePrefix, dto.UID)

	return response.JSON(http.StatusOK, &dto)
}

// DELETE /api/datasources/uid/:uid
func (hs *HTTPServer) DeleteDataSourceByUID(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]

	if uid == "" {
		return response.Error(400, "Missing datasource uid", nil)
	}

	ds, err := hs.getRawDataSourceByUID(c.Req.Context(), uid, c.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(400, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return response.Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceCommand{UID: uid, OrgID: c.OrgId, Name: ds.Name}

	err = hs.DataSourcesService.DeleteDataSource(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(500, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, ds.Uid)

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Data source deleted",
		"id":      ds.Id,
	})
}

// DELETE /api/datasources/name/:name
func (hs *HTTPServer) DeleteDataSourceByName(c *models.ReqContext) response.Response {
	name := web.Params(c.Req)[":name"]

	if name == "" {
		return response.Error(400, "Missing valid datasource name", nil)
	}

	getCmd := &models.GetDataSourceQuery{Name: name, OrgId: c.OrgId}
	if err := hs.DataSourcesService.GetDataSource(c.Req.Context(), getCmd); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to delete datasource", err)
	}

	if getCmd.Result.ReadOnly {
		return response.Error(403, "Cannot delete read-only data source", nil)
	}

	cmd := &models.DeleteDataSourceCommand{Name: name, OrgID: c.OrgId}
	err := hs.DataSourcesService.DeleteDataSource(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(500, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, getCmd.Result.Uid)

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Data source deleted",
		"id":      getCmd.Result.Id,
	})
}

func validateURL(cmdType string, url string) response.Response {
	if _, err := datasource.ValidateURL(cmdType, url); err != nil {
		return response.Error(400, fmt.Sprintf("Validation error, invalid URL: %q", url), err)
	}

	return nil
}

// POST /api/datasources/
func (hs *HTTPServer) AddDataSource(c *models.ReqContext) response.Response {
	cmd := models.AddDataSourceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	datasourcesLogger.Debug("Received command to add data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId
	if cmd.Url != "" {
		if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
			return resp
		}
	}

	if err := hs.DataSourcesService.AddDataSource(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrDataSourceNameExists) || errors.Is(err, models.ErrDataSourceUidExists) {
			return response.Error(409, err.Error(), err)
		}

		return response.Error(500, "Failed to add datasource", err)
	}

	ds := hs.convertModelToDtos(c.Req.Context(), cmd.Result)
	return response.JSON(http.StatusOK, util.DynMap{
		"message":    "Datasource added",
		"id":         cmd.Result.Id,
		"name":       cmd.Result.Name,
		"datasource": ds,
	})
}

// PUT /api/datasources/:id
func (hs *HTTPServer) UpdateDataSourceByID(c *models.ReqContext) response.Response {
	cmd := models.UpdateDataSourceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	datasourcesLogger.Debug("Received command to update data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	var err error
	if cmd.Id, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64); err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
		return resp
	}

	ds, err := hs.getRawDataSourceById(c.Req.Context(), cmd.Id, cmd.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to update datasource", err)
	}
	return hs.updateDataSourceByID(c, ds, cmd)
}

// PUT /api/datasources/:uid
func (hs *HTTPServer) UpdateDataSourceByUID(c *models.ReqContext) response.Response {
	cmd := models.UpdateDataSourceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	datasourcesLogger.Debug("Received command to update data source", "url", cmd.Url)
	cmd.OrgId = c.OrgId
	if resp := validateURL(cmd.Type, cmd.Url); resp != nil {
		return resp
	}

	ds, err := hs.getRawDataSourceByUID(c.Req.Context(), web.Params(c.Req)[":uid"], c.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update datasource", err)
	}
	cmd.Id = ds.Id
	return hs.updateDataSourceByID(c, ds, cmd)
}

func (hs *HTTPServer) updateDataSourceByID(c *models.ReqContext, ds *models.DataSource, cmd models.UpdateDataSourceCommand) response.Response {
	if ds.ReadOnly {
		return response.Error(403, "Cannot update read-only data source", nil)
	}

	err := hs.DataSourcesService.UpdateDataSource(c.Req.Context(), &cmd)
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

	if err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasource", err)
	}

	datasourceDTO := hs.convertModelToDtos(c.Req.Context(), query.Result)

	hs.Live.HandleDatasourceUpdate(c.OrgId, datasourceDTO.UID)

	return response.JSON(http.StatusOK, util.DynMap{
		"message":    "Datasource updated",
		"id":         cmd.Id,
		"name":       cmd.Name,
		"datasource": datasourceDTO,
	})
}

func (hs *HTTPServer) getRawDataSourceById(ctx context.Context, id int64, orgID int64) (*models.DataSource, error) {
	query := models.GetDataSourceQuery{
		Id:    id,
		OrgId: orgID,
	}

	if err := hs.DataSourcesService.GetDataSource(ctx, &query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

func (hs *HTTPServer) getRawDataSourceByUID(ctx context.Context, uid string, orgID int64) (*models.DataSource, error) {
	query := models.GetDataSourceQuery{
		Uid:   uid,
		OrgId: orgID,
	}

	if err := hs.DataSourcesService.GetDataSource(ctx, &query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// Get /api/datasources/name/:name
func (hs *HTTPServer) GetDataSourceByName(c *models.ReqContext) response.Response {
	query := models.GetDataSourceQuery{Name: web.Params(c.Req)[":name"], OrgId: c.OrgId}

	if err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	filtered, err := hs.filterDatasourcesByQueryPermission(c.Req.Context(), c.SignedInUser, []*models.DataSource{query.Result})
	if err != nil || len(filtered) != 1 {
		return response.Error(404, "Data source not found", err)
	}

	dto := hs.convertModelToDtos(c.Req.Context(), filtered[0])
	return response.JSON(http.StatusOK, &dto)
}

// Get /api/datasources/id/:name
func (hs *HTTPServer) GetDataSourceIdByName(c *models.ReqContext) response.Response {
	query := models.GetDataSourceQuery{Name: web.Params(c.Req)[":name"], OrgId: c.OrgId}

	if err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrDataSourceNotFound) {
			return response.Error(404, "Data source not found", nil)
		}
		return response.Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := dtos.AnyId{
		Id: ds.Id,
	}

	return response.JSON(http.StatusOK, &dtos)
}

// /api/datasources/:id/resources/*
func (hs *HTTPServer) CallDatasourceResource(c *models.ReqContext) {
	datasourceID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", err)
		return
	}
	ds, err := hs.DataSourceCache.GetDatasource(c.Req.Context(), datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			c.JsonApiErr(403, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type)
	if !exists {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	hs.callPluginResourceWithDataSource(c, plugin.ID, ds)
}

// /api/datasources/uid/:uid/resources/*
func (hs *HTTPServer) CallDatasourceResourceWithUID(c *models.ReqContext) {
	dsUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(dsUID) {
		c.JsonApiErr(http.StatusBadRequest, "UID is invalid", nil)
		return
	}

	ds, err := hs.DataSourceCache.GetDatasourceByUID(c.Req.Context(), dsUID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			c.JsonApiErr(http.StatusForbidden, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(http.StatusInternalServerError, "Unable to load datasource meta data", err)
		return
	}

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type)
	if !exists {
		c.JsonApiErr(http.StatusInternalServerError, "Unable to find datasource plugin", err)
		return
	}

	hs.callPluginResourceWithDataSource(c, plugin.ID, ds)
}

func (hs *HTTPServer) convertModelToDtos(ctx context.Context, ds *models.DataSource) dtos.DataSource {
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

	secrets, err := hs.DataSourcesService.DecryptedValues(ctx, ds)
	if err == nil {
		for k, v := range secrets {
			if len(v) > 0 {
				dto.SecureJsonFields[k] = true
			}
		}
	} else {
		datasourcesLogger.Debug("Failed to retrieve datasource secrets to parse secure json fields", "error", err)
	}

	return dto
}

// CheckDatasourceHealthWithUID sends a health check request to the plugin datasource
// /api/datasource/uid/:uid/health
func (hs *HTTPServer) CheckDatasourceHealthWithUID(c *models.ReqContext) response.Response {
	dsUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(dsUID) {
		return response.Error(http.StatusBadRequest, "UID is invalid", nil)
	}

	ds, err := hs.DataSourceCache.GetDatasourceByUID(c.Req.Context(), dsUID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			return response.Error(http.StatusForbidden, "Access denied to datasource", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to load datasource metadata", err)
	}
	return hs.checkDatasourceHealth(c, ds)
}

// CheckDatasourceHealth sends a health check request to the plugin datasource
// /api/datasource/:id/health
func (hs *HTTPServer) CheckDatasourceHealth(c *models.ReqContext) response.Response {
	datasourceID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	ds, err := hs.DataSourceCache.GetDatasource(c.Req.Context(), datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			return response.Error(http.StatusForbidden, "Access denied to datasource", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to load datasource metadata", err)
	}
	return hs.checkDatasourceHealth(c, ds)
}

func (hs *HTTPServer) checkDatasourceHealth(c *models.ReqContext, ds *models.DataSource) response.Response {
	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type)
	if !exists {
		return response.Error(http.StatusInternalServerError, "Unable to find datasource plugin", nil)
	}

	dsInstanceSettings, err := adapters.ModelToInstanceSettings(ds, hs.decryptSecureJsonDataFn(c.Req.Context()))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Unable to get datasource model", err)
	}
	req := &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{
			User:                       adapters.BackendUserFromSignedInUser(c.SignedInUser),
			OrgID:                      c.OrgId,
			PluginID:                   plugin.ID,
			DataSourceInstanceSettings: dsInstanceSettings,
		},
	}

	var dsURL string
	if req.PluginContext.DataSourceInstanceSettings != nil {
		dsURL = req.PluginContext.DataSourceInstanceSettings.URL
	}

	err = hs.PluginRequestValidator.Validate(dsURL, c.Req)
	if err != nil {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	resp, err := hs.pluginClient.CheckHealth(c.Req.Context(), req)
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
			return response.Error(http.StatusInternalServerError, "Failed to unmarshal detailed response from backend plugin", err)
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backend.HealthStatusOk {
		return response.JSON(http.StatusBadRequest, payload)
	}

	return response.JSON(http.StatusOK, payload)
}

func (hs *HTTPServer) decryptSecureJsonDataFn(ctx context.Context) func(ds *models.DataSource) map[string]string {
	return func(ds *models.DataSource) map[string]string {
		decryptedJsonData, err := hs.DataSourcesService.DecryptedValues(ctx, ds)
		if err != nil {
			hs.log.Error("Failed to decrypt secure json data", "error", err)
		}
		return decryptedJsonData
	}
}

func (hs *HTTPServer) filterDatasourcesByQueryPermission(ctx context.Context, user *models.SignedInUser, datasources []*models.DataSource) ([]*models.DataSource, error) {
	query := models.DatasourcesPermissionFilterQuery{
		User:        user,
		Datasources: datasources,
	}
	query.Result = datasources

	if err := hs.DatasourcePermissionsService.FilterDatasourcesBasedOnQueryPermissions(ctx, &query); err != nil {
		if !errors.Is(err, permissions.ErrNotImplemented) {
			return nil, err
		}
		return datasources, nil
	}

	return query.Result, nil
}
